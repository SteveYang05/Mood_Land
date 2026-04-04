/**
 * 将 onnxruntime-web 的 .wasm 拷入 public/ort，便于离线加载（不再依赖 CDN）。
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const ortPkgPath = join(root, 'node_modules', 'onnxruntime-web', 'package.json')
const ortDist = join(root, 'node_modules', 'onnxruntime-web', 'dist')
const outDir = join(root, 'public', 'ort')
const stamp = join(outDir, '.ort-version')

if (!existsSync(ortPkgPath)) {
  console.error('缺少 node_modules/onnxruntime-web，请先 npm install')
  process.exit(1)
}

const { version } = JSON.parse(readFileSync(ortPkgPath, 'utf8'))

if (existsSync(stamp) && readFileSync(stamp, 'utf8').trim() === version) {
  const names = await readdir(outDir)
  if (names.some((n) => n.endsWith('.wasm'))) process.exit(0)
}

mkdirSync(outDir, { recursive: true })
const files = await readdir(ortDist)
const wasm = files.filter((f) => f.endsWith('.wasm'))
if (wasm.length === 0) {
  console.error('onnxruntime-web dist 中未找到 .wasm')
  process.exit(1)
}
for (const f of wasm) {
  copyFileSync(join(ortDist, f), join(outDir, f))
}
writeFileSync(stamp, `${version}\n`, 'utf8')
console.log(`已复制 ${wasm.length} 个 ORT wasm → public/ort (onnxruntime-web@${version})`)
