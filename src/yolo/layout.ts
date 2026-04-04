/** 将 ONNX 输出统一为 [84, 8400] 行主序：feature c、anchor i → data[c*8400+i] */
export function flattenYoloOutput(
  data: Float32Array,
  dims: readonly (number | bigint)[],
): Float32Array {
  const d = dims.map((x) => Number(x))
  while (d.length && d[0] === 1) d.shift()
  if (d.length === 2 && d[0] === 84 && d[1] === 8400) return data
  if (d.length === 2 && d[0] === 8400 && d[1] === 84) {
    const out = new Float32Array(84 * 8400)
    for (let i = 0; i < 8400; i++) {
      const base = i * 84
      for (let c = 0; c < 84; c++) {
        out[c * 8400 + i] = data[base + c]!
      }
    }
    return out
  }
  throw new Error(`不支持的 YOLO 输出形状: ${dims.join('×')}`)
}
