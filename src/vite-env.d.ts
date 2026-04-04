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
