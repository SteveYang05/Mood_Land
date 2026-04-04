/**
 * 默认对话模型；可通过环境变量 VITE_CHAT_MODEL 覆盖（会写入构建产物）。
 */
export const CHAT_MODEL =
  import.meta.env.VITE_CHAT_MODEL ?? 'qwen2.5:0.5b-instruct'

/** 视觉推理数据（中性文件名，置于 public/models/ 随 dist 分发） */
export const VISION_BLOB_URL =
  import.meta.env.VITE_VISION_BLOB ?? '/models/app.bin'
