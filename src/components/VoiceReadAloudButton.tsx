import { useVoicePrefs } from '../voice/VoicePrefsContext'
import { speakText } from '../voice/speechSupport'

type Props = {
  text: string
  disabled?: boolean
  /** 按钮文案 */
  label?: string
}

/** 开启「语音朗读」时显示，点击朗读当前文本 */
export default function VoiceReadAloudButton({
  text,
  disabled = false,
  label = '朗读',
}: Props) {
  const { voiceOutput, ttsVoiceURI } = useVoicePrefs()
  if (!voiceOutput) return null
  const t = text.replace(/\s+/g, ' ').trim()
  if (!t) return null
  return (
    <button
      type="button"
      className="btn-voice-read"
      disabled={disabled || !t}
      onClick={() => speakText(t, { voiceURI: ttsVoiceURI })}
      title="朗读当前内容"
    >
      {label}
    </button>
  )
}
