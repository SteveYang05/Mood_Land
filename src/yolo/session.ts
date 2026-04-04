import * as ort from 'onnxruntime-web'
import { letterboxToTensor } from './letterbox'
import { flattenYoloOutput } from './layout'
import {
  largestBoxAreaRatio,
  parseYoloV8Output,
  COCO_PERSON_CLASS,
} from './postprocess'
import type { VisionSummary } from '../llm/prompt'
import type { Detection, LetterboxMeta } from './types'

const base = import.meta.env.BASE_URL
const ortBase = `${base.endsWith('/') ? base : `${base}/`}ort/`
ort.env.wasm.wasmPaths = ortBase
ort.env.wasm.numThreads = 1

export interface YoloRunResult {
  detections: Detection[]
  meta: LetterboxMeta
  frameW: number
  frameH: number
}

export async function createYoloSession(modelUrl: string) {
  return ort.InferenceSession.create(modelUrl, {
    executionProviders: ['wasm'],
    graphOptimizationLevel: 'all',
  })
}

export async function runYoloOnVideoFrame(
  session: ort.InferenceSession,
  video: HTMLVideoElement,
): Promise<YoloRunResult | null> {
  const vw = video.videoWidth
  const vh = video.videoHeight
  if (vw < 16 || vh < 16) return null

  const { data, meta } = letterboxToTensor(video, vw, vh)
  const inputName = session.inputNames[0] ?? 'images'
  const tensor = new ort.Tensor('float32', data, [1, 3, 640, 640])
  const feeds: Record<string, ort.Tensor> = { [inputName]: tensor }
  const out = await session.run(feeds)
  const firstKey = session.outputNames[0]
  if (!firstKey) return null
  const t = out[firstKey]
  if (!t || !t.data) return null

  const flat = flattenYoloOutput(t.data as Float32Array, t.dims ?? [1, 84, 8400])
  const dets = parseYoloV8Output(
    flat,
    meta,
    0.35,
    0.45,
    COCO_PERSON_CLASS,
  )

  return {
    detections: dets,
    meta,
    frameW: vw,
    frameH: vh,
  }
}

export function summarizeForLlm(
  r: YoloRunResult | null,
): Omit<VisionSummary, 'torsoTrend'> {
  if (!r || !r.detections.length) {
    return {
      personPresent: false,
      maxConfidence: 0,
      boxAreaRatio: 0,
      modelActive: true,
    }
  }
  const top = r.detections[0]!
  return {
    personPresent: true,
    maxConfidence: top.confidence,
    boxAreaRatio: largestBoxAreaRatio(
      r.detections,
      r.frameW,
      r.frameH,
    ),
    modelActive: true,
  }
}
