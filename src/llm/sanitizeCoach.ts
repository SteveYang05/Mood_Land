/** 去掉模型复述的提示结构、列表项、编造数据，避免出现在伴读区 */

const LINE_META =
  /请告知|请继续|请描述|作为助手|以下(?:内容|是)|综上所述|根据(?:您的)?要求|用户当前|您当前|\bJSON\b|输出格式|任务(?:要求|说明)|节律阶段|当前节律|对齐的呼吸|帮助用户对齐|不得原样|程序内部|严禁写入|内部状态|rhythm_phase|yolo_|torso_motion|person_in_frame|figure_area|"ph"|"tr"|"pf"|"sc"|"ar"|"ok"|"note"/i

const SENTENCE_META =
  /请告知|请继续|请描述用户|描述您的用户|想要帮助用户|当前节律阶段|对齐的呼吸方式|内部信息|程序内部|不得.*复述/i

/** 出现即表示从该处起多为提示词回声，整段截断 */
const CUT_FROM_MARKERS = [
  '【对方自述】',
  '【画面近况】',
  '【用户自述】',
  '【画面参考】',
  '【仅供你理解',
  '【仅供你理解、禁止写入回复】',
  '【程序内部',
]

function isJunkLine(line: string): boolean {
  const s = line.trim()
  if (!s) return false
  if (/^【/.test(s)) return true
  // 模型爱复述的列表行
  if (/^[-*•]\s/.test(s)) return true
  if (/^[-–—]\s/.test(s)) return true
  if (/镜前是否像有人|形体在画面中|轮廓起伏\s*[:：]/.test(s)) return true
  if (/身体高度|身体比例|\(2D\)|横宽比|横高比|纵向比|\d+\s*厘米/.test(s))
    return true
  if (/画面中身体轮廓略有上移、变大（可能正在吸气，仅供参考）/.test(s))
    return true
  if (/轮廓略收敛（可能正在呼气，仅供参考）/.test(s)) return true
  if (/画面中暂无稳定起伏信息/.test(s) && s.length < 30) return true
  return false
}

/** 去掉模型误输出的状态 JSON 块 */
function stripEmbeddedStateJson(text: string): string {
  if (
    !/rhythm_phase|yolo_person|figure_area|torso_motion|vision_pipeline|"ph"\s*:|"tr"\s*:|"pf"\s*:/i.test(
      text,
    )
  ) {
    return text
  }
  let t = text
  for (let n = 0; n < 4; n++) {
    const i = t.indexOf('{')
    const j = t.lastIndexOf('}')
    if (i === -1 || j <= i) break
    t = (t.slice(0, i) + t.slice(j + 1)).trim()
  }
  return t
}

/** 截断从第一个明显「提示块」标记开始的后缀 */
function truncatePromptEcho(text: string): string {
  let minCut = text.length
  for (const m of CUT_FROM_MARKERS) {
    const i = text.indexOf(m)
    if (i !== -1 && i < minCut) minCut = i
  }
  const loose = text.search(/对方自述\s*[】」]?|画面近况\s*[】」]?/)
  if (loose !== -1 && loose < minCut) minCut = loose
  if (minCut < text.length) return text.slice(0, minCut).trim()
  return text
}

export function sanitizeUserFacingCoach(text: string): string {
  const raw = text.trim()
  if (!raw) return ''

  const strippedJson = stripEmbeddedStateJson(raw)
  const truncated = truncatePromptEcho(strippedJson)

  const paras = truncated
    .split(/\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0 && !LINE_META.test(p) && !isJunkLine(p))

  let out = paras.join('\n\n')

  const sentences = out.split(/(?<=[。！？])(?=\s*[^\s])/)
  const kept = sentences
    .map((s) => s.trim())
    .filter(
      (s) =>
        s.length > 0 &&
        !SENTENCE_META.test(s) &&
        !isJunkLine(s) &&
        !/^【/.test(s),
    )
  if (kept.length) out = kept.join('')

  out = out
    .replace(/\s{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  // 去掉句中夹带的列表残片（同一行内）
  out = out
    .replace(/\s*[-*•]\s*镜前是否[^。！？]*[。！？]?/g, '。')
    .replace(/\s*[-*•]\s*身体[^。！？]*[。！？]?/g, '。')
    .replace(/。\s*。+/g, '。')
    .trim()

  return out
}
