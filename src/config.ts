/**
 * Default chat model; override with VITE_CHAT_MODEL (baked into the build).
 */
export const CHAT_MODEL =
  import.meta.env.VITE_CHAT_MODEL ?? 'qwen2.5:0.5b-instruct'

/** Vision ONNX bundle URL under the site root; default /models/app.bin */
export const VISION_BLOB_URL =
  import.meta.env.VITE_VISION_BLOB ?? '/models/app.bin'
