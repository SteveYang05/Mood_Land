import { useEffect, useRef, useState } from 'react'
import type { ChatTurn } from '../llm/assistant'
import { fetchChatReply } from '../llm/assistant'
import type { VisionSummary } from '../llm/prompt'

const MAX_TURNS = 24

interface LlmChatPanelProps {
  mood: string
  vision: VisionSummary
  model: string
  disabled?: boolean
  compact?: boolean
}

export default function LlmChatPanel({
  mood,
  vision,
  model,
  disabled = false,
  compact = false,
}: LlmChatPanelProps) {
  const [turns, setTurns] = useState<ChatTurn[]>([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [turns, busy])

  const send = async () => {
    const t = draft.trim()
    if (!t || busy) return
    setErr(null)
    setDraft('')
    const userTurn: ChatTurn = { role: 'user', content: t }
    const nextHistory = [...turns, userTurn].slice(-MAX_TURNS)
    setTurns(nextHistory)
    setBusy(true)
    try {
      const { text, ok } = await fetchChatReply(mood, vision, nextHistory, {
        model,
      })
      if (!ok || !text.trim()) {
        setErr('暂时没有回复，请确认本机助手可用后重试。')
        return
      }
      const assistantTurn: ChatTurn = { role: 'assistant', content: text }
      setTurns((prev) => [...prev, assistantTurn].slice(-MAX_TURNS))
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
            <h2 className="feature-title">聊天</h2>
            <span className="feature-tag">多模态情境</span>
          </div>
          <p className="feature-hint">
            与助手自由对话；每次发送时，会把当前自述与镜前画面摘要（多模态）一并交给模型，回复会尽量呼应你当下的空间感与身体动静。
          </p>
        </>
      )}
      <div
        className={compact ? 'chat-log chat-log--tab' : 'chat-log'}
        role="log"
        aria-live="polite"
      >
        {turns.length === 0 && (
          <p className="chat-empty">还没有消息，说一句开场吧。</p>
        )}
        {turns.map((m, i) => (
          <div
            key={`${i}-${m.role}-${m.content.slice(0, 12)}`}
            className={
              m.role === 'user' ? 'chat-bubble chat-bubble--user' : 'chat-bubble chat-bubble--assistant'
            }
          >
            {m.content}
          </div>
        ))}
        {busy && <p className="chat-pending">正在回复…</p>}
        <div ref={bottomRef} />
      </div>
      {err && <p className="feature-error">{err}</p>}
      <div className="chat-input-row chat-input-row--tab">
        <textarea
          className="feature-textarea chat-input"
          rows={compact ? 1 : 2}
          placeholder="说话… Ctrl+Enter 发送"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={disabled || busy}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault()
              void send()
            }
          }}
        />
        <button
          type="button"
          className="btn-secondary chat-send"
          disabled={disabled || busy || !draft.trim()}
          onClick={() => void send()}
        >
          发送
        </button>
      </div>
    </article>
  )
}
