import type { LetterboxMeta } from './types'

const INPUT = 640

/** YOLOv8 常用输入 640，灰边 114 */
export function letterboxToTensor(
  source: CanvasImageSource,
  sw: number,
  sh: number,
): { data: Float32Array; meta: LetterboxMeta } {
  const scale = Math.min(INPUT / sw, INPUT / sh)
  const nw = Math.round(sw * scale)
  const nh = Math.round(sh * scale)
  const padX = (INPUT - nw) / 2
  const padY = (INPUT - nh) / 2

  const canvas = document.createElement('canvas')
  canvas.width = INPUT
  canvas.height = INPUT
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2d context')
  ctx.fillStyle = 'rgb(114,114,114)'
  ctx.fillRect(0, 0, INPUT, INPUT)
  ctx.drawImage(source, 0, 0, sw, sh, padX, padY, nw, nh)

  const img = ctx.getImageData(0, 0, INPUT, INPUT)
  const { data } = img
  const plane = INPUT * INPUT
  const out = new Float32Array(3 * plane)
  for (let y = 0; y < INPUT; y++) {
    for (let x = 0; x < INPUT; x++) {
      const i = (y * INPUT + x) * 4
      const r = data[i]! / 255
      const g = data[i + 1]! / 255
      const b = data[i + 2]! / 255
      out[0 * plane + y * INPUT + x] = r
      out[1 * plane + y * INPUT + x] = g
      out[2 * plane + y * INPUT + x] = b
    }
  }

  return {
    data: out,
    meta: { scale, padX, padY, origW: sw, origH: sh },
  }
}

export { INPUT as YOLO_INPUT_SIZE }
