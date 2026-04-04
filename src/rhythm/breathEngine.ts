import type { RhythmParams } from './schema'

export type BreathSegment = 'inhale' | 'holdIn' | 'exhale' | 'holdOut'

export interface SegmentSpec {
  type: BreathSegment
  durationMs: number
}

export interface BreathState {
  segment: BreathSegment
  /** 当前段内 0–1 */
  progress: number
  /** 整周期视觉缩放 0–1，用于圆环 */
  visualScale: number
  cycleMs: number
}

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x))
}

function smoothstep(t: number): number {
  const x = clamp01(t)
  return x * x * (3 - 2 * x)
}

export function buildSegments(params: RhythmParams): SegmentSpec[] {
  const c = params.cycleSeconds * 1000
  const norm =
    params.inhaleRatio +
    params.holdAfterInhaleRatio +
    params.exhaleRatio +
    params.holdAfterExhaleRatio
  const k = norm > 0 ? c / norm : c / 4
  return [
    { type: 'inhale', durationMs: params.inhaleRatio * k },
    { type: 'holdIn', durationMs: params.holdAfterInhaleRatio * k },
    { type: 'exhale', durationMs: params.exhaleRatio * k },
    { type: 'holdOut', durationMs: params.holdAfterExhaleRatio * k },
  ]
}

/** 由缩放强度推导视觉幅度（像素律动） */
export function scaleAmplitude(intensity: number): number {
  return 0.22 + 0.38 * clamp01(intensity)
}

export function getBreathState(
  nowMs: number,
  anchorMs: number,
  params: RhythmParams,
): BreathState {
  const segments = buildSegments(params)
  const cycleMs = segments.reduce((s, x) => s + x.durationMs, 0) || 16000
  const t = ((nowMs - anchorMs) % cycleMs + cycleMs) % cycleMs
  let acc = 0
  let segment: BreathSegment = 'inhale'
  let progress = 0
  let dur = 1
  for (const s of segments) {
    if (t < acc + s.durationMs) {
      segment = s.type
      dur = s.durationMs || 1
      progress = (t - acc) / dur
      break
    }
    acc += s.durationMs
  }

  let visualScale = 0.5
  if (segment === 'inhale') {
    visualScale = smoothstep(progress)
  } else if (segment === 'holdIn') {
    visualScale = 1
  } else if (segment === 'exhale') {
    visualScale = 1 - smoothstep(progress)
  } else {
    visualScale = 0
  }

  return { segment, progress, visualScale, cycleMs }
}

export function segmentLabelZh(s: BreathSegment): string {
  switch (s) {
    case 'inhale':
      return '吸气'
    case 'holdIn':
      return '屏息'
    case 'exhale':
      return '呼气'
    case 'holdOut':
      return '自然停顿'
    default:
      return ''
  }
}
