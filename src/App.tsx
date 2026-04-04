import { useCallback, useEffect, useRef, useState } from 'react'
import type { InferenceSession } from 'onnxruntime-web'
import CameraPreview from './components/CameraPreview'
import HeatmapRhythm from './components/HeatmapRhythm'
import MoodInput from './components/MoodInput'
import { CHAT_MODEL, VISION_BLOB_URL } from './config'
import {
  fetchLiveCoachFromOllama,
  fetchRhythmFromOllama,
} from './llm/assistant'
import { sanitizeUserFacingCoach } from './llm/sanitizeCoach'
import type { VisionSummary } from './llm/prompt'
import { getBreathState, segmentLabelZh } from './rhythm/breathEngine'
import { DEFAULT_RHYTHM } from './rhythm/defaults'
import { FALLBACK_COACH } from './rhythm/schema'
import type { RhythmParams } from './rhythm/schema'
import { breathSyncHint } from './vision/breathSync'
import {
  TorsoBreathTracker,
  heightNormFromDetection,
} from './vision/torsoBreathTracker'
import {
  createYoloSession,
  runYoloOnVideoFrame,
  summarizeForLlm,
} from './yolo/session'
import './App.css'

function emptyVision(modelActive: boolean): VisionSummary {
  return {
    personPresent: false,
    maxConfidence: 0,
    boxAreaRatio: 0,
    modelActive,
    torsoTrend: 'unknown',
  }
}

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const trackerRef = useRef(new TorsoBreathTracker())
  const anchorMsRef = useRef(performance.now())
  const rhythmRef = useRef<RhythmParams>(DEFAULT_RHYTHM)
  const syncMismatchSinceRef = useRef<number | null>(null)
  const moodRef = useRef('')
  const visionRef = useRef<VisionSummary>(emptyVision(false))
  const liveInFlightRef = useRef(false)
  const busyRef = useRef(false)

  const [mood, setMood] = useState('')
  const [cameraOn, setCameraOn] = useState(false)
  const [session, setSession] = useState<InferenceSession | null>(null)
  const [softNotice, setSoftNotice] = useState<string | null>(null)
  const [vision, setVision] = useState<VisionSummary>(() => emptyVision(false))
  const [rhythm, setRhythm] = useState<RhythmParams>(DEFAULT_RHYTHM)
  const [anchorMs, setAnchorMs] = useState(() => performance.now())
  const [running, setRunning] = useState(false)
  const [syncHint, setSyncHint] = useState<string | null>(null)
  const [statusLine, setStatusLine] = useState('')
  const [busy, setBusy] = useState(false)
  const [coachStream, setCoachStream] = useState('')

  useEffect(() => {
    busyRef.current = busy
  }, [busy])

  useEffect(() => {
    anchorMsRef.current = anchorMs
    rhythmRef.current = rhythm
  }, [anchorMs, rhythm])

  useEffect(() => {
    moodRef.current = mood
  }, [mood])

  useEffect(() => {
    visionRef.current = vision
  }, [vision])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const s = await createYoloSession(VISION_BLOB_URL)
        if (!cancelled) {
          setSession(s)
          setSoftNotice(null)
          setVision((v) => ({ ...v, modelActive: true }))
        }
      } catch {
        if (!cancelled) {
          setSession(null)
          setSoftNotice('可选的画面辅助未能就绪，将主要根据你的文字来调整。')
          setVision(emptyVision(false))
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const stopCamera = useCallback(() => {
    const v = videoRef.current
    if (v?.srcObject) {
      const tracks = (v.srcObject as MediaStream).getTracks()
      tracks.forEach((t) => t.stop())
      v.srcObject = null
    }
  }, [])

  useEffect(() => {
    if (!cameraOn) {
      stopCamera()
      trackerRef.current.reset()
      setVision(emptyVision(!!session))
      setSyncHint(null)
      return
    }
    const el = videoRef.current
    if (!el) return
    let alive = true
    trackerRef.current.reset()
    ;(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 540 } },
          audio: false,
        })
        if (!alive) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        el.srcObject = stream
        await el.play()
      } catch {
        setCameraOn(false)
        setSoftNotice('未能使用摄像头，仍可只用文字描述感受。')
      }
    })()
    return () => {
      alive = false
    }
  }, [cameraOn, stopCamera, session])

  useEffect(() => {
    if (!session || !cameraOn) return
    const v = videoRef.current
    if (!v) return
    const id = window.setInterval(async () => {
      if (v.readyState < 2) return
      try {
        const r = await runYoloOnVideoFrame(session, v)
        const top = r?.detections[0]
        if (r && top) {
          const hn = heightNormFromDetection(r.frameH, top)
          trackerRef.current.push(hn, true)
        } else if (r) {
          trackerRef.current.push(null, false)
        } else {
          trackerRef.current.push(null, false)
        }
        setVision({
          ...summarizeForLlm(r),
          torsoTrend: trackerRef.current.trendForPrompt(),
        })
      } catch {
        setVision({
          ...summarizeForLlm(null),
          torsoTrend: trackerRef.current.trendForPrompt(),
        })
      }
    }, 520)
    return () => clearInterval(id)
  }, [session, cameraOn])

  useEffect(() => {
    return () => stopCamera()
  }, [stopCamera])

  /** 进行中：按节律间隔拉取短句伴读（最新 mood + 画面摘要 + 当前阶段） */
  useEffect(() => {
    if (!running) return
    let cancelled = false
    const cycleMs = rhythm.cycleSeconds * 1000
    const intervalMs = Math.round(
      Math.min(52000, Math.max(16000, cycleMs * 0.62)),
    )

    const tick = async () => {
      if (cancelled || liveInFlightRef.current || busyRef.current) return
      liveInFlightRef.current = true
      try {
        const st = getBreathState(
          performance.now(),
          anchorMsRef.current,
          rhythmRef.current,
        )
        const phaseZh = segmentLabelZh(st.segment)
        const { text, ok } = await fetchLiveCoachFromOllama(
          moodRef.current,
          visionRef.current,
          phaseZh,
          { model: CHAT_MODEL },
        )
        if (cancelled || !ok) return
        const line = text.trim()
        if (!line) return
        setCoachStream((prev) => {
          const next = prev ? `${prev}\n\n${line}` : line
          return next.length > 3000 ? next.slice(-3000) : next
        })
      } finally {
        liveInFlightRef.current = false
      }
    }

    const iv = window.setInterval(() => void tick(), intervalMs)
    const boot = window.setTimeout(() => void tick(), 4200)
    return () => {
      cancelled = true
      clearInterval(iv)
      clearTimeout(boot)
    }
  }, [running, rhythm.cycleSeconds])

  useEffect(() => {
    if (!running || !cameraOn) {
      setSyncHint(null)
      syncMismatchSinceRef.current = null
      return
    }
    const tick = () => {
      const now = performance.now()
      const st = getBreathState(now, anchorMsRef.current, rhythmRef.current)
      const obs = trackerRef.current.observedPhase()
      const raw = breathSyncHint(st.segment, obs)
      if (raw) {
        if (syncMismatchSinceRef.current == null) {
          syncMismatchSinceRef.current = now
          setSyncHint(null)
        } else if (now - syncMismatchSinceRef.current > 700) {
          setSyncHint(raw)
        }
      } else {
        syncMismatchSinceRef.current = null
        setSyncHint(null)
      }
    }
    const id = window.setInterval(tick, 240)
    tick()
    return () => clearInterval(id)
  }, [running, cameraOn])

  const syncRhythm = async () => {
    setBusy(true)
    setStatusLine('')
    try {
      const { params, ok } = await fetchRhythmFromOllama(mood, vision, {
        model: CHAT_MODEL,
      })
      setRhythm(params)
      setCoachStream(params.coachMessage ?? FALLBACK_COACH)
      setAnchorMs(performance.now())
      setStatusLine(
        ok
          ? '新的节奏与伴读已更新，按「开始」跟随即可。'
          : '暂时保留温和默认节奏。若本机助手未在运行，请先打开后再试。',
      )
    } finally {
      setBusy(false)
    }
  }

  const toggleRun = () => {
    if (running) {
      setRunning(false)
      setSyncHint(null)
      syncMismatchSinceRef.current = null
      return
    }
    setAnchorMs(performance.now())
    setRunning(true)
  }

  return (
    <div className="app">
      <div className="app-bg" aria-hidden />
      <header className="header">
        <p className="eyebrow">慢下来</p>
        <h1>心境漫游</h1>
        <p className="tagline">色彩随呼吸起伏，自述与画面只在本机陪伴你。</p>
      </header>

      <main className="main">
        <section className="visual-column">
          <div className="heatmap-wrap">
            <HeatmapRhythm
              params={rhythm}
              anchorMs={anchorMs}
              running={running}
              syncHint={syncHint}
            />
          </div>
          <div className="camera-panel">
            {cameraOn ? (
              <>
                <CameraPreview ref={videoRef} active />
                <span className="camera-label">你的画面</span>
              </>
            ) : (
              <div className="camera-placeholder">
                <p>打开「使用摄像头」后，可看见自己并与节律轻柔对齐（可选）。</p>
              </div>
            )}
          </div>
          {!cameraOn && <CameraPreview ref={videoRef} active={false} />}
        </section>

        <section className="control-column">
          <article className="coach-card">
            <div className="coach-card-head">
              <h2 className="coach-title">伴读</h2>
              {running && <span className="coach-pulse">随呼吸更新</span>}
            </div>
            <p className="coach-body">
              {sanitizeUserFacingCoach(
                coachStream.trim() ? coachStream : (rhythm.coachMessage ?? ''),
              ) || (rhythm.coachMessage ?? FALLBACK_COACH)}
            </p>
          </article>

          <MoodInput value={mood} onChange={setMood} disabled={busy} />

          <label className="toggle-row">
            <input
              type="checkbox"
              checked={cameraOn}
              onChange={(e) => setCameraOn(e.target.checked)}
            />
            <span>使用摄像头（可选）</span>
          </label>

          {softNotice && <p className="notice">{softNotice}</p>}

          <div className="actions">
            <button type="button" className="btn-primary" disabled={busy} onClick={() => void syncRhythm()}>
              {busy ? '正在为你写节奏…' : '生成节奏与伴读'}
            </button>
            <button type="button" className="btn-quiet" onClick={toggleRun}>
              {running ? '暂停' : '开始'}
            </button>
          </div>

          {statusLine && <p className="status">{statusLine}</p>}

          <p className="footnote">
            仅供放松辅助；轮廓起伏判断不精确，请以自身舒适为准。使用前请在本机启动配套助手服务。
          </p>
        </section>
      </main>
    </div>
  )
}
