/* eslint-disable react-refresh/only-export-components -- Provider 与 useVoicePrefs 同文件便于维护 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { cancelSpeechSynthesis } from './speechSupport'

const KEY_IN = 'moodland-voice-input'
const KEY_OUT = 'moodland-voice-output'
const KEY_TTS_VOICE = 'moodland-tts-voice-uri'

type VoicePrefs = {
  voiceInput: boolean
  voiceOutput: boolean
  /** 朗读用 TTS：空字符串表示「自动选中文（推荐）」 */
  ttsVoiceURI: string
  setVoiceInput: (v: boolean) => void
  setVoiceOutput: (v: boolean) => void
  setTtsVoiceURI: (uri: string) => void
}

const VoicePrefsContext = createContext<VoicePrefs | null>(null)

function readBool(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

function readTtsVoiceURI(): string {
  try {
    return localStorage.getItem(KEY_TTS_VOICE) ?? ''
  } catch {
    return ''
  }
}

export function VoicePrefsProvider({ children }: { children: ReactNode }) {
  const [voiceInput, setVoiceInputState] = useState(() => readBool(KEY_IN))
  const [voiceOutput, setVoiceOutputState] = useState(() => readBool(KEY_OUT))
  const [ttsVoiceURI, setTtsVoiceURIState] = useState(() => readTtsVoiceURI())

  const setVoiceInput = useCallback((v: boolean) => {
    setVoiceInputState(v)
    try {
      localStorage.setItem(KEY_IN, v ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [])

  const setVoiceOutput = useCallback((v: boolean) => {
    setVoiceOutputState(v)
    try {
      localStorage.setItem(KEY_OUT, v ? '1' : '0')
    } catch {
      /* ignore */
    }
    if (!v) cancelSpeechSynthesis()
  }, [])

  const setTtsVoiceURI = useCallback((uri: string) => {
    setTtsVoiceURIState(uri)
    try {
      if (uri) localStorage.setItem(KEY_TTS_VOICE, uri)
      else localStorage.removeItem(KEY_TTS_VOICE)
    } catch {
      /* ignore */
    }
  }, [])

  const value = useMemo(
    () => ({
      voiceInput,
      voiceOutput,
      ttsVoiceURI,
      setVoiceInput,
      setVoiceOutput,
      setTtsVoiceURI,
    }),
    [voiceInput, voiceOutput, ttsVoiceURI, setVoiceInput, setVoiceOutput, setTtsVoiceURI],
  )

  return (
    <VoicePrefsContext.Provider value={value}>
      {children}
    </VoicePrefsContext.Provider>
  )
}

export function useVoicePrefs(): VoicePrefs {
  const ctx = useContext(VoicePrefsContext)
  if (!ctx) {
    throw new Error('useVoicePrefs must be used within VoicePrefsProvider')
  }
  return ctx
}
