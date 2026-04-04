import { CHAT_MODEL } from '../config'
import {
  FALLBACK_COACH,
  parseRhythmJson,
  type RhythmParams,
} from '../rhythm/schema'
import { DEFAULT_RHYTHM } from '../rhythm/defaults'
import {
  CHAT_CONV_SYSTEM,
  LIVE_COACH_USER_FIXED,
  STORY_SYSTEM_PROMPT,
  buildChatMultimodalContext,
  buildLiveCoachSystemWithYoloPayload,
  buildStoryUserPrompt,
  buildUserPrompt,
  SYSTEM_PROMPT,
  type VisionSummary,
} from './prompt'
import { sanitizeUserFacingCoach } from './sanitizeCoach'

export type AssistantBackend = 'ollama' | 'openai'

export function assistantBackend(): AssistantBackend {
  const v = import.meta.env.VITE_ASSISTANT_BACKEND
  if (v === 'openai') return 'openai'
  return 'ollama'
}

/** 开发 + ollama 时用 Vite 代理前缀；否则为助手根 URL（无尾斜杠） */
export function assistantBaseUrl(): string {
  if (import.meta.env.DEV && assistantBackend() === 'ollama') {
    return '/api/ollama'
  }
  const fallback =
    assistantBackend() === 'openai'
      ? 'http://127.0.0.1:12434'
      : 'http://127.0.0.1:11434'
  return (import.meta.env.VITE_ASSISTANT_URL ?? fallback).replace(/\/$/, '')
}

function ollamaChatUrl(base: string): string {
  const b = base.replace(/\/$/, '')
  return b.endsWith('/api/chat') ? b : `${b}/api/chat`
}

function openAiChatUrl(base: string): string {
  const b = base.replace(/\/$/, '')
  return `${b}/v1/chat/completions`
}

/** Model id sent to the assistant API */
function requestModel(): string {
  return CHAT_MODEL
}

function parseOpenAiContent(data: unknown): string {
  const d = data as {
    choices?: { message?: { content?: string } }[]
  }
  return (d.choices?.[0]?.message?.content ?? '').trim()
}

function parseOllamaContent(data: unknown): string {
  const d = data as { message?: { content?: string } }
  return (d.message?.content ?? '').trim()
}

export interface AssistantOptions {
  model?: string
  baseUrl?: string
}

export async function fetchRhythmFromAssistant(
  mood: string,
  vision: VisionSummary,
  options: AssistantOptions = {},
): Promise<{ params: RhythmParams; raw: string; ok: boolean }> {
  const model = options.model ?? requestModel()
  const baseUrl = (options.baseUrl ?? assistantBaseUrl()).replace(/\/$/, '')
  const backend = assistantBackend()

  let raw = ''

  try {
    if (backend === 'openai') {
      const url = openAiChatUrl(baseUrl)
      const body = {
        model,
        stream: false,
        temperature: 0.68,
        max_tokens: 520,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: `${buildUserPrompt(mood, vision)}\n请只输出一个 JSON 对象，勿其它文字。`,
          },
        ],
      }
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        raw = await res.text()
        return { params: DEFAULT_RHYTHM, raw, ok: false }
      }
      const data = await res.json()
      raw = parseOpenAiContent(data)
    } else {
      const url = ollamaChatUrl(baseUrl)
      const body = {
        model,
        stream: false,
        format: 'json',
        options: {
          temperature: 0.68,
          num_predict: 520,
        },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildUserPrompt(mood, vision) },
        ],
      }
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        raw = await res.text()
        return { params: DEFAULT_RHYTHM, raw, ok: false }
      }
      const data = await res.json()
      raw = parseOllamaContent(data)
    }
  } catch (e) {
    raw = e instanceof Error ? e.message : String(e)
    return { params: DEFAULT_RHYTHM, raw, ok: false }
  }

  const parsed = parseRhythmJson(raw)
  if (parsed) {
    const cleaned = {
      ...parsed,
      coachMessage:
        sanitizeUserFacingCoach(parsed.coachMessage ?? '') || FALLBACK_COACH,
    }
    const sum =
      cleaned.inhaleRatio +
      cleaned.holdAfterInhaleRatio +
      cleaned.exhaleRatio +
      cleaned.holdAfterExhaleRatio
    if (sum > 0 && Math.abs(sum - 1) > 0.08) {
      const k = 1 / sum
      return {
        params: {
          ...cleaned,
          inhaleRatio: cleaned.inhaleRatio * k,
          holdAfterInhaleRatio: cleaned.holdAfterInhaleRatio * k,
          exhaleRatio: cleaned.exhaleRatio * k,
          holdAfterExhaleRatio: cleaned.holdAfterExhaleRatio * k,
        },
        raw,
        ok: true,
      }
    }
    return { params: cleaned, raw, ok: true }
  }
  return { params: DEFAULT_RHYTHM, raw, ok: false }
}

export const fetchRhythmFromOllama = fetchRhythmFromAssistant

export async function fetchLiveCoachFromAssistant(
  mood: string,
  vision: VisionSummary,
  rhythmPhaseZh: string,
  options: AssistantOptions = {},
): Promise<{ text: string; ok: boolean }> {
  const model = options.model ?? requestModel()
  const baseUrl = (options.baseUrl ?? assistantBaseUrl()).replace(/\/$/, '')
  const backend = assistantBackend()

  try {
    if (backend === 'openai') {
      const url = openAiChatUrl(baseUrl)
      const body = {
        model,
        stream: false,
        temperature: 0.74,
        max_tokens: 140,
        messages: [
          {
            role: 'system',
            content: buildLiveCoachSystemWithYoloPayload(
              rhythmPhaseZh,
              mood,
              vision,
            ),
          },
          { role: 'user', content: LIVE_COACH_USER_FIXED },
        ],
      }
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) return { text: '', ok: false }
      const data = await res.json()
      const raw = parseOpenAiContent(data)
      const stripped = raw.replace(/^["「『]|["」』]$/g, '').trim()
      const text = sanitizeUserFacingCoach(stripped)
      return { text, ok: text.length > 0 }
    }

    const url = ollamaChatUrl(baseUrl)
    const body = {
      model,
      stream: false,
      options: {
        temperature: 0.74,
        num_predict: 140,
      },
      messages: [
        {
          role: 'system',
          content: buildLiveCoachSystemWithYoloPayload(
            rhythmPhaseZh,
            mood,
            vision,
          ),
        },
        { role: 'user', content: LIVE_COACH_USER_FIXED },
      ],
    }
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) return { text: '', ok: false }
    const data = await res.json()
    const raw = parseOllamaContent(data)
    const stripped = raw.replace(/^["「『]|["」』]$/g, '').trim()
    const text = sanitizeUserFacingCoach(stripped)
    return { text, ok: text.length > 0 }
  } catch {
    return { text: '', ok: false }
  }
}

export const fetchLiveCoachFromOllama = fetchLiveCoachFromAssistant

type ChatRole = 'system' | 'user' | 'assistant'

async function postChatCompletion(
  messages: { role: ChatRole; content: string }[],
  options: AssistantOptions & {
    temperature: number
    maxTokens: number
    jsonFormat?: boolean
  },
): Promise<{ text: string; ok: boolean }> {
  const model = options.model ?? requestModel()
  const baseUrl = (options.baseUrl ?? assistantBaseUrl()).replace(/\/$/, '')
  const backend = assistantBackend()
  const { temperature, maxTokens, jsonFormat } = options

  try {
    if (backend === 'openai') {
      const url = openAiChatUrl(baseUrl)
      const body: Record<string, unknown> = {
        model,
        stream: false,
        temperature,
        max_tokens: maxTokens,
        messages,
      }
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) return { text: '', ok: false }
      const data = await res.json()
      const raw = parseOpenAiContent(data)
      return { text: raw, ok: raw.length > 0 }
    }

    const url = ollamaChatUrl(baseUrl)
    const body: Record<string, unknown> = {
      model,
      stream: false,
      options: {
        temperature,
        num_predict: maxTokens,
      },
      messages,
    }
    if (jsonFormat) body.format = 'json'
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) return { text: '', ok: false }
    const data = await res.json()
    const raw = parseOllamaContent(data)
    return { text: raw, ok: raw.length > 0 }
  } catch {
    return { text: '', ok: false }
  }
}

export interface StoryOptions extends AssistantOptions {
  storyHint?: string
  rhythmPhaseZh?: string
  running?: boolean
}

/** Personalized short story from mood, vision summary, optional hint, and breath phase */
export async function fetchPersonalizedStory(
  mood: string,
  vision: VisionSummary,
  options: StoryOptions = {},
): Promise<{ text: string; ok: boolean }> {
  const userContent = buildStoryUserPrompt(mood, vision, {
    storyHint: options.storyHint,
    rhythmPhaseZh: options.rhythmPhaseZh,
    running: options.running,
  })
  const { text, ok } = await postChatCompletion(
    [
      { role: 'system', content: STORY_SYSTEM_PROMPT },
      { role: 'user', content: userContent },
    ],
    {
      model: options.model,
      baseUrl: options.baseUrl,
      temperature: 0.82,
      maxTokens: 960,
    },
  )
  if (!ok) return { text: '', ok: false }
  const cleaned = sanitizeUserFacingCoach(
    text.replace(/^["「『]|["」』]$/g, '').trim(),
  )
  return { text: cleaned, ok: cleaned.length > 0 }
}

export type ChatTurn = { role: 'user' | 'assistant'; content: string }

/** Multi-turn chat; system message includes current mood and vision summary each call */
export async function fetchChatReply(
  mood: string,
  vision: VisionSummary,
  historyForApi: ChatTurn[],
  options: AssistantOptions & { maxTokens?: number } = {},
): Promise<{ text: string; ok: boolean }> {
  const maxTokens = options.maxTokens ?? 512
  const systemFull = `${CHAT_CONV_SYSTEM}\n\n${buildChatMultimodalContext(mood, vision)}`
  const wrapped: { role: ChatRole; content: string }[] = [
    { role: 'system', content: systemFull },
  ]
  for (const m of historyForApi) {
    wrapped.push({ role: m.role, content: m.content })
  }
  const { text, ok } = await postChatCompletion(wrapped, {
    model: options.model,
    baseUrl: options.baseUrl,
    temperature: 0.72,
    maxTokens,
  })
  if (!ok) return { text: '', ok: false }
  const cleaned = sanitizeUserFacingCoach(
    text.replace(/^["「『]|["」』]$/g, '').trim(),
  )
  return { text: cleaned, ok: cleaned.length > 0 }
}
