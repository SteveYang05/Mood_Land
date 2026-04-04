import type { RhythmParams } from './schema'
import { FALLBACK_COACH } from './schema'

export const DEFAULT_RHYTHM: RhythmParams = {
  cycleSeconds: 16,
  inhaleRatio: 0.35,
  holdAfterInhaleRatio: 0.1,
  exhaleRatio: 0.45,
  holdAfterExhaleRatio: 0.1,
  rhythmIntensity: 0.55,
  themeHue: 200,
  guidance: '吸气时让色块更亮，呼气时让它慢慢来。',
  coachMessage: FALLBACK_COACH,
}
