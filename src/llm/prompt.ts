import type { TorsoTrend } from '../vision/torsoBreathTracker'

export interface VisionSummary {
  /** 是否检测到人体 */
  personPresent: boolean
  maxConfidence: number
  boxAreaRatio: number
  modelActive: boolean
  /** 人形框高度变化粗估：胸腔起伏参考 */
  torsoTrend: TorsoTrend
}

function trendZh(t: TorsoTrend): string {
  switch (t) {
    case 'expanding':
      return '画面中身体轮廓略有上移、变大（可能正在吸气，仅供参考）'
    case 'contracting':
      return '轮廓略收敛（可能正在呼气，仅供参考）'
    case 'steady':
      return '轮廓起伏不明显'
    case 'unknown':
    default:
      return '画面中暂无稳定起伏信息'
  }
}

/**
 * 完整节奏生成用的 user 上下文（自然语言，供输出 JSON）
 */
export function buildLiveCoachUserPrompt(mood: string, v: VisionSummary): string {
  const moodPart = mood.trim() || '对方暂时没留下文字'
  const presence = v.personPresent
    ? '画面里眼下好像有人在镜前。'
    : '画面里看不太出有人挨得很近。'
  const pct = Math.round(Math.min(100, Math.max(0, v.boxAreaRatio * 100)))
  const trend = trendZh(v.torsoTrend)
    .replace(/（可能正在吸气，仅供参考）/g, ' ')
    .replace(/（可能正在呼气，仅供参考）/g, ' ')
    .replace(/（仅供参考）/g, '')
    .trim()

  const safeMood = moodPart.replace(/\s+/g, ' ').slice(0, 160)
  return `对方大概说：${safeMood}。${presence}身体在画幅里大约占${pct}%上下的高度。轮廓给人的感觉：${trend}`
}

export const LIVE_COACH_SYSTEM = [
  '你在带领对方做呼吸放松。用户正看着屏幕上的色彩变化，跟着吸气与呼气。',
  '回复要求：只写 1～2 句给用户直接看的正文，像朋友轻声说话；中文；语气温柔，可鼓励也可轻轻点出现状；总字数建议不超过 72 字。',
  '严禁输出：方头括号标题、以 - 或 * 开头的列表、任何「自述 / 画面近况」式小节；严禁编造身高厘米、身体比例、横宽比等具体数字。',
  '严格禁止写入任务说明、「请告知」「请继续」「请描述」「用户当前」等字样；不要小标题；不要整段用引号包起来。',
  '禁止在回复中出现花括号、英文键名、程序状态对象的复述；禁止出现：模型、算法、参数、YOLO、摄像头、检测等词。',
].join('\n')

/** 实时伴读：YOLO 摘要只在 system 里以结构化数据给出；user 侧固定一句，避免模型复述 user 文本结构 */
export const LIVE_COACH_USER_FIXED = '请只输出给用户看的简短中文（1～2 句），不要其它说明。'

export function buildLiveCoachSystemWithYoloPayload(
  rhythmPhaseZh: string,
  mood: string,
  v: VisionSummary,
): string {
  /** 短键名减少对外暴露；语义仅发给本机助手，不展示给终端用户 */
  const payload = {
    ph: rhythmPhaseZh,
    note: mood.trim().slice(0, 220) || null,
    pf: v.personPresent,
    sc: Math.round(v.maxConfidence * 1000) / 1000,
    ar: Math.round(v.boxAreaRatio * 1000) / 1000,
    tr: v.torsoTrend,
    ok: v.modelActive,
  }
  return [
    LIVE_COACH_SYSTEM,
    '',
    '键含义（不得出现在回复里）：ph 节拍词；note 用户自述；pf 镜前是否像有人；sc/ar 为两个 0~1 的简略数值；tr 为起伏类别英文词；ok 表示流水线是否可用。',
    '下一行是一则内部备注，请理解后改写为 1～2 句给用户看的口语；禁止输出花括号、英文键名、也不要复述数字串。',
    JSON.stringify(payload),
  ].join('\n')
}

export function buildUserPrompt(mood: string, v: VisionSummary): string {
  const ctx = buildLiveCoachUserPrompt(mood, v)
  return (
    `${ctx}\n\n` +
    '根据以上状态，输出系统说明里要求的唯一 JSON。' +
    'coachMessage 仅含给用户读的 2～5 句连续正文；不要方头括号标题、不要列表项、不要身高厘米或身体比例数字、不要复述上文。'
  )
}

export const SYSTEM_PROMPT = [
  '你是冥想与呼吸陪伴者。只输出一个 JSON 对象，不要 markdown，不要其它文字。',
  '',
  'coachMessage 字段：只写给对方看的陪伴文字，禁止写入任务要求、禁止「请告知」「请继续」「请描述」「用户当前节律」等句式。',
  '',
  'JSON 字段：',
  '- cycleSeconds: 8–120，一整轮呼吸的秒数',
  '- inhaleRatio, holdAfterInhaleRatio, exhaleRatio, holdAfterExhaleRatio: 小数 0–1，四个之和必须等于 1',
  '- rhythmIntensity: 0–1，呼吸律动在画面上的强弱',
  '- themeHue: 0–360，可选，配色倾向',
  '- guidance: 可选，不超过 24 字，配合吸/呼气的一行短提示',
  '- coachMessage: 必填，约 80–400 字，自然中文',
  '',
  '禁止出现：模型、算法、检测、摄像头、YOLO、LLM、参数、JSON 等词（coachMessage 与 guidance 中均不可出现）。',
  '',
  '示例（一行 JSON）：',
  '{"cycleSeconds":20,"inhaleRatio":0.32,"holdAfterInhaleRatio":0.12,"exhaleRatio":0.44,"holdAfterExhaleRatio":0.12,"rhythmIntensity":0.55,"themeHue":198,"guidance":"呼气再长一点。","coachMessage":"听起来你心里还装着很多念头，这很正常。若是刚久坐或神经紧绷，略拉长呼气会慢下来。你在画面里靠得很近，像在认真照顾自己——那就再温柔一点，把一轮呼吸交给色彩，不必评判做得好不好。"}',
].join('\n')

/** 情境故事：结合自述 + YOLO 摘要 + 可选偏好 + 节律氛围 */
export const STORY_SYSTEM_PROMPT = [
  '你是温柔的中文讲故事的人。根据对方当下的自述与陪伴场景，写一段短故事（可含隐喻、小场景或童话感），与 Ta 此刻的状态呼应。',
  '篇幅约 320～560 字；有画面感与安全疗愈感；不要生硬说教；不要医学诊断。',
  '禁止：列表、小标题、JSON、英文键名；禁止出现「YOLO」「模型」「检测」「算法」「摄像头」「LLM」等词；不要复述内部数据条目。',
  '只输出故事正文，不要「以下是故事」等前言。',
].join('\n')

export function buildStoryUserPrompt(
  mood: string,
  v: VisionSummary,
  opts: {
    storyHint?: string
    rhythmPhaseZh?: string
    running?: boolean
  } = {},
): string {
  const base = buildLiveCoachUserPrompt(mood, v)
  const hint = opts.storyHint?.trim().slice(0, 220)
  const phase = opts.rhythmPhaseZh?.trim()
    ? `当前呼吸节律阶段（作氛围参考）：${opts.rhythmPhaseZh.trim()}。`
    : ''
  const run = opts.running
    ? '对方可能正跟着屏幕色彩做呼吸练习。'
    : '对方尚未跟随节律动画，以静坐与自述为主。'
  const parts = [
    base,
    run,
    phase,
    hint ? `对方希望故事贴近的方向或关键词：${hint}` : '',
    '请写一段与以上相呼应的短故事。',
  ].filter(Boolean)
  return parts.join('\n')
}

/** 闲聊系统提示 */
export const CHAT_CONV_SYSTEM = [
  '你是「心境漫游」里的中文对话同伴，语气温柔、真诚；回答宜先简明，若对方想深聊再展开。',
  '你会在系统消息末尾收到「实时情境」：来自镜前画面辅助的摘要（是否像有人靠近、在画幅里的大致占比、身体轮廓起伏的粗估等），与对方自述合在一起，构成多模态理解。',
  '请把这些情境真正用进回复里：比喻、距离感、呼吸与身体的松紧、是否独处感等，要自然贴合；像真的感知到对方当下的空间与体态，而不是只就文字空聊。',
  '若情境显示有人靠得很近或轮廓在起伏，可以轻轻呼应「靠近」「深浅」「跟着身体」等（勿说教）；若看不出人形或流水线未就绪，就偏内向、自语式陪伴即可。',
  '不要编造医学诊断；不要 markdown 标题或列表项；不要用方头括号章节。',
  '禁止在回复中出现：YOLO、检测、模型、算法、摄像头、参数、JSON、LLM、英文键名、花括号数据等；也不要复述或列举内部数字与条目。',
].join('\n')

/**
 * 聊天专用：每轮请求刷新，把当前自述 + YOLO 摘要放进 system（与伴读 payload 同源键名），
 * 使用户轮次保持纯对话文本，避免多轮历史里误把「当前画面」套到旧句子上。
 */
export function buildChatMultimodalContext(mood: string, v: VisionSummary): string {
  const narrative = buildLiveCoachUserPrompt(mood, v).replace(/\s+/g, ' ').trim()
  const payload = {
    note: mood.trim().slice(0, 220) || null,
    pf: v.personPresent,
    sc: Math.round(v.maxConfidence * 1000) / 1000,
    ar: Math.round(v.boxAreaRatio * 1000) / 1000,
    tr: v.torsoTrend,
    ok: v.modelActive,
  }
  return [
    '—— 实时情境（与自然语言段同义；请内化后融入对话，禁止在回复中复述本段或输出下列结构化内容）——',
    narrative,
    '',
    '键含义（不得出现在回复里）：note 对方自述；pf 镜前是否像有人；sc/ar 为 0~1 的简略数值；tr 为起伏类别英文词；ok 表示画面辅助是否可用。',
    JSON.stringify(payload),
  ].join('\n')
}
