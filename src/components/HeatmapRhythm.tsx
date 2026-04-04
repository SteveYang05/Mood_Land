import { useEffect, useRef } from 'react'
import type { RhythmParams } from '../rhythm/schema'
import { getBreathState, scaleAmplitude, segmentLabelZh } from '../rhythm/breathEngine'

type Props = {
  params: RhythmParams
  anchorMs: number
  running: boolean
  /** 与画面粗估呼吸不同步时的提示 */
  syncHint: string | null
}

/** 与 16:9 画幅一致的栅格：64×36 */
const GW = 64
const GH = 36

function fract(n: number): number {
  return n - Math.floor(n)
}

function hash2(ix: number, iy: number, seed: number): number {
  const n = Math.sin(ix * 12.9898 + iy * 78.233 + seed) * 43758.5453
  return fract(Math.abs(n))
}

/** 偏静谧的“热力”渐变：深青 → 碧色 → 琥珀 → 淡珊瑚 */
function heatColor(t: number): [number, number, number] {
  const x = Math.min(1, Math.max(0, t))
  const stops: [number, [number, number, number]][] = [
    [0, [12, 28, 52]],
    [0.28, [30, 88, 118]],
    [0.52, [42, 148, 132]],
    [0.78, [196, 168, 92]],
    [1, [232, 168, 148]],
  ]
  for (let i = 0; i < stops.length - 1; i++) {
    const [t0, c0] = stops[i]!
    const [t1, c1] = stops[i + 1]!
    if (x <= t1) {
      const k = t1 === t0 ? 0 : (x - t0) / (t1 - t0)
      return [
        Math.round(c0[0] + (c1[0] - c0[0]) * k),
        Math.round(c0[1] + (c1[1] - c0[1]) * k),
        Math.round(c0[2] + (c1[2] - c0[2]) * k),
      ]
    }
  }
  const c = stops[stops.length - 1]![1]
  return c
}

type Dims = { picW: number; picH: number; cell: number }

export default function HeatmapRhythm({
  params,
  anchorMs,
  running,
  syncHint,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const paramsRef = useRef(params)
  const anchorRef = useRef(anchorMs)
  const runningRef = useRef(running)
  const syncHintRef = useRef<string | null>(null)
  const dimsRef = useRef<Dims>({ picW: 320, picH: 180, cell: 320 / GW })

  useEffect(() => {
    paramsRef.current = params
    anchorRef.current = anchorMs
    runningRef.current = running
  }, [params, anchorMs, running])

  useEffect(() => {
    syncHintRef.current = syncHint
  }, [syncHint])

  useEffect(() => {
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    if (!wrap || !canvas) return
    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) return

    let alive = true

    const applySize = () => {
      const r = wrap.getBoundingClientRect()
      let picW = Math.floor(r.width)
      let picH = Math.floor((picW * 9) / 16)
      if (picH > r.height && r.height > 8) {
        picH = Math.floor(r.height)
        picW = Math.floor((picH * 16) / 9)
      }
      picW = Math.max(96, picW)
      picH = Math.max(54, picH)
      const cell = picW / GW
      dimsRef.current = { picW, picH, cell }

      const dpr = Math.min(2, window.devicePixelRatio || 1)
      canvas.width = Math.round(picW * dpr)
      canvas.height = Math.round(picH * dpr)
      canvas.style.width = `${picW}px`
      canvas.style.height = `${picH}px`
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.scale(dpr, dpr)
    }

    const ro = new ResizeObserver(() => applySize())
    applySize()
    ro.observe(wrap)

    const loop = () => {
      if (!alive) return
      const p = paramsRef.current
      const hueShift = ((p.themeHue ?? 200) - 200) * 0.15
      const anch = anchorRef.current
      const run = runningRef.current
      const amp = scaleAmplitude(p.rhythmIntensity)
      const now = performance.now()
      const { picW, picH, cell } = dimsRef.current

      const fsIdleLg = Math.max(11, Math.round(picW * 0.034))
      const fsIdleSm = Math.max(10, Math.round(picW * 0.03))
      const fsSeg = Math.max(12, Math.round(picW * 0.039))
      const fsGuide = Math.max(10, Math.round(picW * 0.03))
      const fsHint = Math.max(10, Math.round(picW * 0.03))
      const barTop = Math.max(22, picH * 0.12)
      const barBot = Math.max(40, picH * 0.24)

      if (!run) {
        ctx.fillStyle = '#0a0e16'
        ctx.fillRect(0, 0, picW, picH)
        ctx.fillStyle = 'rgba(170, 185, 210, 0.35)'
        ctx.font = `${fsIdleLg}px system-ui, sans-serif`
        ctx.textAlign = 'center'
        ctx.fillText('轻触「开始」后，随色彩起伏呼吸', picW / 2, picH / 2 - fsIdleLg * 0.45)
        ctx.font = `${fsIdleSm}px system-ui, sans-serif`
        ctx.fillText('越深越沉静，越亮越舒展', picW / 2, picH / 2 + fsIdleLg * 0.75)
        rafRef.current = requestAnimationFrame(loop)
        return
      }

      const st = getBreathState(now, anch, p)
      const tCell = (now / 380) % 1000
      const pulse = st.visualScale

      for (let j = 0; j < GH; j++) {
        for (let i = 0; i < GW; i++) {
          const nx = (i + 0.5) / GW - 0.5
          const ny = (j + 0.5) / GH - 0.5
          const dist = Math.sqrt(nx * nx + ny * ny) * 1.35
          const wave =
            0.5 +
            0.5 * Math.sin(now * 0.0018 + dist * 6.2 - pulse * Math.PI * 1.2)
          const n1 = hash2(i, j, Math.floor(tCell))
          const n2 = hash2(i + 17, j + 31, Math.floor(tCell * 0.7))
          const grain = (n1 * 0.55 + n2 * 0.45 - 0.5) * 0.22 * amp
          let v =
            pulse * (1.15 - dist) * 0.62 +
            wave * 0.18 * amp +
            grain +
            (n1 - 0.5) * 0.08 * (1 - dist)
          v += hueShift * 0.02
          v = Math.min(1, Math.max(0, v))

          const [r, g, b] = heatColor(v)
          ctx.fillStyle = `rgb(${r},${g},${b})`
          ctx.fillRect(i * cell, j * cell, cell + 0.5, cell + 0.5)
        }
      }

      const hint = syncHintRef.current
      if (run && hint) {
        ctx.fillStyle = 'rgba(38, 28, 32, 0.92)'
        ctx.fillRect(0, 0, picW, barTop)
        ctx.fillStyle = 'rgba(255, 232, 218, 0.96)'
        ctx.font = `600 ${fsHint}px system-ui, sans-serif`
        ctx.textAlign = 'center'
        const line = hint.length > 40 ? `${hint.slice(0, 39)}…` : hint
        ctx.fillText(line, picW / 2, barTop * 0.62)
      }

      ctx.fillStyle = 'rgba(10, 12, 20, 0.42)'
      ctx.fillRect(0, picH - barBot, picW, barBot)
      ctx.fillStyle = 'rgba(245, 248, 255, 0.95)'
      ctx.font = `600 ${fsSeg}px system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.fillText(segmentLabelZh(st.segment), picW / 2, picH - barBot * 0.45)
      if (p.guidance) {
        ctx.font = `${fsGuide}px system-ui, sans-serif`
        ctx.fillStyle = 'rgba(210, 218, 235, 0.82)'
        const g =
          p.guidance.length > 36 ? `${p.guidance.slice(0, 35)}…` : p.guidance
        ctx.fillText(g, picW / 2, picH - barBot * 0.18)
      }

      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => {
      alive = false
      cancelAnimationFrame(rafRef.current)
      ro.disconnect()
    }
  }, [])

  return (
    <div ref={wrapRef} className="heatmap-rhythm-root">
      <canvas
        ref={canvasRef}
        className="heatmap-rhythm"
        aria-label="呼吸律动热力图"
      />
    </div>
  )
}
