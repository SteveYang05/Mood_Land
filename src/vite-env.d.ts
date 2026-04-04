/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CHAT_MODEL?: string
  /** Vision ONNX URL under site root; default /models/app.bin */
  readonly VITE_VISION_BLOB?: string
  /** ollama (default) or openai (OpenAI-compatible /v1/chat/completions) */
  readonly VITE_ASSISTANT_BACKEND?: string
  /** Assistant base URL when not using the dev proxy */
  readonly VITE_ASSISTANT_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
