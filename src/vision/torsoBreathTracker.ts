/** 用人形检测框高度在画面中的变化，粗略推断胸腔起伏（非医学）；噪声较大，仅作辅助 */

export type TorsoTrend = 'expanding' | 'contracting' | 'steady' | 'unknown'

export type ObservedBreath = 'inhale' | 'exhale' | 'uncertain'

const MAX_SAMPLES = 22

function avg(arr: number[]): number {
  if (!arr.length) return 0
  return arr.reduce((s, x) => s + x, 0) / arr.length
}

export class TorsoBreathTracker {
  private heights: number[] = []

  push(heightNorm: number | null, personSeen: boolean) {
    if (!personSeen || heightNorm == null || !Number.isFinite(heightNorm)) return
    this.heights.push(Math.min(0.95, Math.max(0.05, heightNorm)))
    if (this.heights.length > MAX_SAMPLES) this.heights.shift()
  }

  reset() {
    this.heights = []
  }

  private splitDelta(): number {
    const h = this.heights
    if (h.length < 10) return 0
    const mid = Math.floor(h.length / 2)
    return avg(h.slice(mid)) - avg(h.slice(0, mid))
  }

  /** 给文案模型看的离散标签 */
  trendForPrompt(): TorsoTrend {
    const d = this.splitDelta()
    if (this.heights.length < 10) return 'unknown'
    if (d > 0.0045) return 'expanding'
    if (d < -0.0045) return 'contracting'
    return 'steady'
  }

  /** 与指导节律比对用 */
  observedPhase(): ObservedBreath {
    const d = this.splitDelta()
    if (this.heights.length < 10) return 'uncertain'
    if (d > 0.004) return 'inhale'
    if (d < -0.004) return 'exhale'
    return 'uncertain'
  }
}

/** 从最大人形框取归一化高度（相对画幅），用于起伏趋势 */
export function heightNormFromDetection(
  frameH: number,
  box: { y1: number; y2: number } | undefined,
): number | null {
  if (!box || frameH <= 0) return null
  return Math.max(0, box.y2 - box.y1) / frameH
}
