import { useCallback, useEffect, useRef, useState } from 'react'
import { useVoicePrefs } from '../voice/VoicePrefsContext'
import { getSpeechRecognitionCtor } from '../voice/speechSupport'

type Props = {
  /** 将识别到的文字追加到当前输入（由父组件拼接） */
  onAppend: (text: string) => void
  disabled?: boolean
  /** 放在输入框旁时的简短标签 */
  label?: string
}

/**
 * 按住式：点一下开始听写，再点结束并写入；需浏览器支持 Web Speech API。
 */
export default function VoiceDictationButton({
  onAppend,
  disabled = false,
  label = '语音',
}: Props) {
  const { voiceInput } = useVoicePrefs()
  const [listening, setListening] = useState(false)
  const recRef = useRef<SpeechRecognition | null>(null)
  const finalBuf = useRef('')

  const stop = useCallback(() => {
    try {
      recRef.current?.stop()
    } catch {
      /* ignore */
    }
    recRef.current = null
    setListening(false)
  }, [])

  useEffect(() => () => stop(), [stop])

  const toggle = useCallback(() => {
    if (disabled || !voiceInput) return
    const Ctor = getSpeechRecognitionCtor()
    if (!Ctor) return
    if (listening) {
      stop()
      return
    }
    finalBuf.current = ''
    const rec = new Ctor()
    rec.lang = 'zh-CN'
    rec.continuous = true
    rec.interimResults = true
    rec.onresult = (ev: SpeechRecognitionEvent) => {
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i]
        if (r?.isFinal && r[0]) {
          finalBuf.current += r[0].transcript
        }
      }
    }
    rec.onerror = () => {
      stop()
    }
    rec.onend = () => {
      const t = finalBuf.current.replace(/\s+/g, ' ').trim()
      recRef.current = null
      setListening(false)
      if (t) onAppend(t)
    }
    recRef.current = rec
    setListening(true)
    try {
      rec.start()
    } catch {
      setListening(false)
      recRef.current = null
    }
  }, [disabled, listening, onAppend, stop, voiceInput])

  const Ctor = typeof window !== 'undefined' ? getSpeechRecognitionCtor() : null
  if (!voiceInput || !Ctor) return null

  return (
    <button
      type="button"
      className={listening ? 'voice-mic voice-mic--on' : 'voice-mic'}
      disabled={disabled}
      onClick={() => toggle()}
      title={listening ? '点击结束听写并填入' : '点击开始语音输入（再点结束）'}
    >
      {listening ? '●' : label}
    </button>
  )
}
