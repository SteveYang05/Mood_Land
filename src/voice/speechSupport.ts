/** Web Speech API：Chrome / Edge / Tauri WebView2 等通常可用；Firefox/Safari 支持度不一 */

export function getSpeechRecognitionCtor(): (new () => SpeechRecognition) | null {
  if (typeof window === 'undefined') return null
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null
}

export function isSpeechRecognitionSupported(): boolean {
  return getSpeechRecognitionCtor() != null
}

export function cancelSpeechSynthesis(): void {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel()
  }
}

function isChineseVoice(v: SpeechSynthesisVoice): boolean {
  const lang = (v.lang || '').toLowerCase().replace('_', '-')
  if (lang.startsWith('zh')) return true
  if (lang.includes('cmn')) return true
  const n = v.name.toLowerCase()
  if (/[\u4e00-\u9fff]/.test(v.name)) return true
  if (
    /xiaoxiao|yunxi|yunjian|xiaoyi|yaoyao|huihui|hanhan|kangkang|lili|maoxi|hiugaai|sin-ji|meijia|ting|zhiyu|xiaochen|xiaomo|xiaorui|xiaoshuang|xiaoxuan|yunfeng|yunhao|yunxia|yunye|yunyang|zh-CN|chinese/i.test(
      n,
    )
  ) {
    return true
  }
  return false
}

/** 为中文朗读排序：优先神经/自然语音，尽量避免默认英语机械声 */
function scoreVoiceForChinese(v: SpeechSynthesisVoice): number {
  let s = 0
  const n = v.name.toLowerCase()
  const lang = (v.lang || '').toLowerCase().replace('_', '-')
  if (lang.startsWith('zh-cn')) s += 45
  else if (lang.startsWith('zh-tw') || lang.startsWith('zh-hk')) s += 38
  else if (lang.startsWith('zh')) s += 35
  else if (isChineseVoice(v)) s += 22
  if (/neural|natural|premium|enhanced|wavenet|online|\.com/i.test(n)) s += 55
  if (/microsoft|google|apple/.test(n) && isChineseVoice(v)) s += 12
  if (/samantha|zarvox|alex|victoria|daniel|fred|vicki|princess/i.test(n) && !isChineseVoice(v)) {
    s -= 80
  }
  if (v.default && isChineseVoice(v)) s += 4
  return s
}

export function pickPreferredChineseVoice(
  voices: SpeechSynthesisVoice[],
): SpeechSynthesisVoice | null {
  if (!voices.length) return null
  const zh = voices.filter(isChineseVoice)
  const pool = zh.length ? zh : voices
  const sorted = [...pool].sort(
    (a, b) => scoreVoiceForChinese(b) - scoreVoiceForChinese(a),
  )
  return sorted[0] ?? null
}

/** 按用户保存的 voiceURI 解析；找不到时回退到自动优选中文 */
export function resolveTtsVoice(
  voices: SpeechSynthesisVoice[],
  voiceURI: string | null | undefined,
): SpeechSynthesisVoice | null {
  if (!voices.length) return null
  const key = (voiceURI || '').trim()
  if (key) {
    const byUri = voices.find((v) => v.voiceURI === key)
    if (byUri) return byUri
    const byName = voices.find((v) => v.name === key)
    if (byName) return byName
  }
  return pickPreferredChineseVoice(voices)
}

export type SpeakOptions = {
  /** 空字符串或未传：自动选较自然的中文声音 */
  voiceURI?: string | null
}

export function speakText(text: string, opts?: SpeakOptions): void {
  const t = text.replace(/\s+/g, ' ').trim()
  if (!t || typeof window === 'undefined' || !window.speechSynthesis) return
  window.speechSynthesis.cancel()
  const voices = window.speechSynthesis.getVoices()
  const voice = resolveTtsVoice(voices, opts?.voiceURI ?? null)

  const u = new SpeechSynthesisUtterance(t.slice(0, 8000))
  if (voice) {
    u.voice = voice
    const lang = (voice.lang || '').trim()
    u.lang =
      lang && (lang.toLowerCase().startsWith('zh') || lang.toLowerCase().includes('cmn'))
        ? lang.replace('_', '-')
        : 'zh-CN'
  } else {
    u.lang = 'zh-CN'
  }

  const n = (voice?.name || '').toLowerCase()
  const neural = /neural|natural|premium|wavenet|enhanced/i.test(n)
  u.rate = neural ? 0.98 : 0.94
  u.pitch = 1
  window.speechSynthesis.speak(u)
}

/** 下拉展示用：中文相关优先，其余按名称 */
export function sortVoicesForPicker(
  voices: SpeechSynthesisVoice[],
): SpeechSynthesisVoice[] {
  return [...voices].sort((a, b) => {
    const ca = isChineseVoice(a) ? 0 : 1
    const cb = isChineseVoice(b) ? 0 : 1
    if (ca !== cb) return ca - cb
    return scoreVoiceForChinese(b) - scoreVoiceForChinese(a) || a.name.localeCompare(b.name)
  })
}
