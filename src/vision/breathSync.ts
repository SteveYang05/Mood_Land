import type { BreathSegment } from '../rhythm/breathEngine'
import type { ObservedBreath } from './torsoBreathTracker'

/** 指导节律与画面粗估呼吸不一致时的短提示 */
export function breathSyncHint(
  segment: BreathSegment,
  observed: ObservedBreath,
): string | null {
  if (observed === 'uncertain') return null
  if (segment === 'holdIn' || segment === 'holdOut') return null
  if (segment === 'inhale' && observed === 'exhale') {
    return '节律此处还是吸气，再慢慢吸一点点。'
  }
  if (segment === 'exhale' && observed === 'inhale') {
    return '先跟随节律慢慢呼气，不必急着吸。'
  }
  return null
}
