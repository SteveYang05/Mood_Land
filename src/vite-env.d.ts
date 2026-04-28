/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CHAT_MODEL?: string
  /** 视觉权重在站点根路径下的 URL，默认 /models/app.bin */
  readonly VITE_VISION_BLOB?: string
  /** ollama（默认）或 openai（llama-server 等 OpenAI 兼容 /v1/chat/completions） */
  readonly VITE_ASSISTANT_BACKEND?: string
  /** 非 dev 或 openai 模式下的助手根 URL，默认 http://127.0.0.1:12434 */
  readonly VITE_ASSISTANT_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

/** Web Speech API：部分 TS lib.dom 版本未收录 */
interface SpeechRecognition extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  start(): void
  stop(): void
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null
  onend: ((this: SpeechRecognition) => void) | null
}

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number
  readonly results: SpeechRecognitionResultList
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string
}

interface SpeechRecognitionResultList {
  readonly length: number
  item(index: number): SpeechRecognitionResult
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionResult {
  readonly length: number
  readonly isFinal: boolean
  item(index: number): SpeechRecognitionAlternative
  [index: number]: SpeechRecognitionAlternative
}

interface SpeechRecognitionAlternative {
  readonly transcript: string
  readonly confidence: number
}

interface Window {
  SpeechRecognition?: { new (): SpeechRecognition }
  webkitSpeechRecognition?: { new (): SpeechRecognition }
}
