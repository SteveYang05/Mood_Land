import type { Detection, LetterboxMeta } from './types'

const NUM_PRED = 8400
const NUM_CLASS = 80
/** COCO: 0 = person，用作「镜前有人」代理 */
export const COCO_PERSON_CLASS = 0

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x))
}

function iou(a: Detection, b: Detection): number {
  const x1 = Math.max(a.x1, b.x1)
  const y1 = Math.max(a.y1, b.y1)
  const x2 = Math.min(a.x2, b.x2)
  const y2 = Math.min(a.y2, b.y2)
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1)
  const ar = Math.max(0, a.x2 - a.x1) * Math.max(0, a.y2 - a.y1)
  const br = Math.max(0, b.x2 - b.x1) * Math.max(0, b.y2 - b.y1)
  return inter / (ar + br - inter + 1e-9)
}

/**
 * YOLOv8 ONNX 输出 [1, 84, 8400]：前 4 行为 cx,cy,w,h（640 输入坐标），后 80 为类别 logit。
 */
export function parseYoloV8Output(
  tensorData: Float32Array,
  meta: LetterboxMeta,
  confThreshold = 0.35,
  iouThreshold = 0.45,
  classFilter: number | null = COCO_PERSON_CLASS,
): Detection[] {
  const d = tensorData
  const raw: Detection[] = []

  for (let i = 0; i < NUM_PRED; i++) {
    const cx = d[0 * NUM_PRED + i]!
    const cy = d[1 * NUM_PRED + i]!
    const w = d[2 * NUM_PRED + i]!
    const h = d[3 * NUM_PRED + i]!

    let bestScore = 0
    let bestCls = 0
    for (let c = 0; c < NUM_CLASS; c++) {
      const logit = d[(4 + c) * NUM_PRED + i]!
      const score = logit > 1 || logit < 0 ? logit : sigmoid(logit)
      if (score > bestScore) {
        bestScore = score
        bestCls = c
      }
    }

    if (bestScore < confThreshold) continue
    if (classFilter !== null && bestCls !== classFilter) continue

    const x1b = cx - w / 2
    const y1b = cy - h / 2
    const x2b = cx + w / 2
    const y2b = cy + h / 2

    const x1o = (x1b - meta.padX) / meta.scale
    const y1o = (y1b - meta.padY) / meta.scale
    const x2o = (x2b - meta.padX) / meta.scale
    const y2o = (y2b - meta.padY) / meta.scale

    raw.push({
      x1: x1o,
      y1: y1o,
      x2: x2o,
      y2: y2o,
      confidence: bestScore,
      classId: bestCls,
    })
  }

  raw.sort((a, b) => b.confidence - a.confidence)
  const kept: Detection[] = []
  for (const box of raw) {
    if (kept.every((k) => iou(box, k) < iouThreshold)) kept.push(box)
    if (kept.length >= 8) break
  }
  return kept
}

export function largestBoxAreaRatio(
  dets: Detection[],
  frameW: number,
  frameH: number,
): number {
  if (!dets.length || frameW <= 0 || frameH <= 0) return 0
  const a = frameW * frameH
  let max = 0
  for (const d of dets) {
    const ar =
      Math.max(0, d.x2 - d.x1) * Math.max(0, d.y2 - d.y1)
    max = Math.max(max, ar / a)
  }
  return max
}
