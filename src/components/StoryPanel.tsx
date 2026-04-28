import { useEffect, useRef, useState } from 'react'
import { fetchPersonalizedStory } from '../llm/assistant'
import type { VisionSummary } from '../llm/prompt'
import { getBreathState, segmentLabelZh } from '../rhythm/breathEngine'
import type { RhythmParams } from '../rhythm/schema'
import VoiceDictationButton from './VoiceDictationButton'
import VoiceReadAloudButton from './VoiceReadAloudButton'
import { useVoicePrefs } from '../voice/VoicePrefsContext'
import { speakText } from '../voice/speechSupport'

interface StoryPanelProps {
  mood: string
  vision: VisionSummary
  running: boolean
  rhythm: RhythmParams
  anchorMs: number
  model: string
  disabled?: boolean
  compact?: boolean
}

export default function StoryPanel({
  mood,
  vision,
  running,
  rhythm,
  anchorMs,
  model,
  disabled = false,
  compact = false,
}: StoryPanelProps) {
  const { voiceOutput, ttsVoiceURI } = useVoicePrefs()
  const [hint, setHint] = useState('')
  const [story, setStory] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const lastSpokenStory = useRef('')

  useEffect(() => {
    if (!voiceOutput || !story.trim()) return
    if (story === lastSpokenStory.current) return
    lastSpokenStory.current = story
    speakText(story, { voiceURI: ttsVoiceURI })
  }, [story, voiceOutput, ttsVoiceURI])

  const generate = async () => {
    setBusy(true)
    setErr(null)
    try {
      const st = getBreathState(performance.now(), anchorMs, rhythm)
      const phaseZh = segmentLabelZh(st.segment)
      const { text, ok } = await fetchPersonalizedStory(mood, vision, {
        model,
        storyHint: hint.trim() || undefined,
        rhythmPhaseZh: phaseZh,
        running,
      })
      if (!ok || !text.trim()) {
        setErr('故事暂时没生成出来，请确认本机助手已运行后再试。')
        return
      }
      setStory(text)
    } finally {
      setBusy(false)
    }
  }

  const rootClass = compact
    ? 'feature-card feature-card--tab'
    : 'feature-card'

  return (
    <article className={rootClass}>
      {!compact && (
        <>
          <div className="feature-card-head">
            <h2 className="feature-title">情境故事</h2>
            <span className="feature-tag">画面摘要 + 自述</span>
          </div>
          <p className="feature-hint">
            结合你写下的感受、当前画面摘要与呼吸节律氛围，生成一段只属于你的小故事（可填偏好，也可留空）。
          </p>
        </>
      )}
      <label className="feature-label" htmlFor="story-hint">
        偏好（可选）
      </label>
      <div className="feature-textarea-wrap">
        <textarea
          id="story-hint"
          className="feature-textarea"
          rows={compact ? 1 : 2}
          placeholder="海边、小动物、勇气…"
          value={hint}
          onChange={(e) => setHint(e.target.value)}
          disabled={disabled || busy}
          maxLength={220}
        />
        <VoiceDictationButton
          disabled={disabled || busy}
          onAppend={(t) => setHint((h) => (h ? `${h} ${t}`.trim() : t).slice(0, 220))}
        />
      </div>
      <div className="story-actions-row">
        <button
          type="button"
          className="btn-secondary"
          disabled={disabled || busy}
          onClick={() => void generate()}
        >
          {busy ? '生成中…' : '生成本刻故事'}
        </button>
        <VoiceReadAloudButton text={story} disabled={busy || !story} />
      </div>
      {err && <p className="feature-error">{err}</p>}
      {story && (
        <div
          className={compact ? 'story-body story-body--tab' : 'story-body'}
          role="region"
          aria-label="生成的故事"
        >
          {story}
        </div>
      )}
    </article>
  )
}
