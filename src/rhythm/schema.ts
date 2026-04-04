import { z } from 'zod'

/** 节奏参数 + 教练式一段话（多模态输出） */
export const RhythmParamsSchema = z.object({
  cycleSeconds: z.number().min(8).max(120),
  inhaleRatio: z.number().min(0.15).max(0.55),
  holdAfterInhaleRatio: z.number().min(0).max(0.35),
  exhaleRatio: z.number().min(0.15).max(0.55),
  holdAfterExhaleRatio: z.number().min(0).max(0.35),
  rhythmIntensity: z.number().min(0).max(1),
  themeHue: z.number().min(0).max(360).optional(),
  guidance: z.string().max(140).optional(),
  /** 2～5 句：结合心情与画面；若缺失则由客户端补默认 */
  coachMessage: z.string().max(900).optional(),
})

export type RhythmParams = z.infer<typeof RhythmParamsSchema>

const FALLBACK_COACH =
  '先花一点时间感受自己的呼吸就好。肩膀可以略松一点，节奏不用完美，跟随画面里的色块起落就可以。'

export function parseRhythmJson(text: string): RhythmParams | null {
  const trimmed = text.trim()
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return null
  let raw: unknown
  try {
    raw = JSON.parse(trimmed.slice(start, end + 1))
  } catch {
    return null
  }
  const r = RhythmParamsSchema.safeParse(raw)
  if (!r.success) return null
  const d = r.data
  const coach =
    d.coachMessage && d.coachMessage.trim().length >= 12
      ? d.coachMessage.trim()
      : FALLBACK_COACH
  return { ...d, coachMessage: coach }
}

export { FALLBACK_COACH }
