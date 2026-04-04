/**
 * 下载视觉推理数据到 public/models/app.bin（中性文件名，便于分发）
 */
import { writeFile, mkdir, copyFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dest = join(__dirname, '..', 'public', 'models', 'app.bin')
const legacy = join(__dirname, '..', 'public', 'models', 'yolov8n.onnx')
const url =
  'https://huggingface.co/salim4n/yolov8n-detect-onnx/resolve/main/yolov8n-onnx-web/yolov8n.onnx'

await mkdir(dirname(dest), { recursive: true })

try {
  await copyFile(legacy, dest)
  console.log('已从 yolov8n.onnx 复制为', dest)
  process.exit(0)
} catch {
  // fall through to download
}

const res = await fetch(url, { redirect: 'follow' })
if (!res.ok) throw new Error(`下载失败 HTTP ${res.status}: ${url}`)
const buf = Buffer.from(await res.arrayBuffer())
await writeFile(dest, buf)
console.log('已保存', dest, `(${(buf.length / 1024 / 1024).toFixed(2)} MB)`)
