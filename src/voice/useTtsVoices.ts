import { useEffect, useState } from 'react'

/** 浏览器异步加载语音列表，订阅 voiceschanged 后刷新 */
export function useTtsVoices(): SpeechSynthesisVoice[] {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() =>
    typeof window !== 'undefined' && window.speechSynthesis
      ? window.speechSynthesis.getVoices()
      : [],
  )

  useEffect(() => {
    const syn = window.speechSynthesis
    if (!syn) return

    const load = () => {
      setVoices(syn.getVoices())
    }
    load()
    syn.addEventListener('voiceschanged', load)
    const t = window.setTimeout(load, 400)
    return () => {
      syn.removeEventListener('voiceschanged', load)
      clearTimeout(t)
    }
  }, [])

  return voices
}
