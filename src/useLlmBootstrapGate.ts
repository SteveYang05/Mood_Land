import { useEffect, useState } from 'react'

export type LlmBootOverlay = {
  open: boolean
  /** 主标题下展示的多行说明（来自 Rust 事件） */
  detail: string
  error: string | null
}

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

/**
 * Desktop (Tauri): show a boot overlay until the bundled LLM helper is ready.
 * Web / `npm run dev`: no overlay (`__TAURI_INTERNALS__` absent).
 */
export function useLlmBootstrapGate(): LlmBootOverlay {
  const [s, setS] = useState<LlmBootOverlay>(() =>
    isTauriRuntime()
      ? {
          open: true,
          detail: '正在连接本机对话服务…',
          error: null,
        }
      : { open: false, detail: '', error: null },
  )

  useEffect(() => {
    if (!isTauriRuntime()) return

    let cancelled = false
    let poll: ReturnType<typeof setInterval> | undefined
    const unsubs: Array<() => void> = []

    const run = async () => {
      const { listen } = await import('@tauri-apps/api/event')
      const { invoke } = await import('@tauri-apps/api/core')
      if (cancelled) return

      unsubs.push(
        await listen<string>('llm-bootstrap-start', (e) => {
          if (cancelled) return
          const t = typeof e.payload === 'string' ? e.payload : String(e.payload ?? '')
          setS({ open: true, detail: t || '正在准备…', error: null })
        }),
      )
      unsubs.push(
        await listen<string>('llm-download-progress', (e) => {
          if (cancelled) return
          const t = typeof e.payload === 'string' ? e.payload : String(e.payload ?? '')
          setS((prev) => ({
            open: true,
            detail: t || prev.detail,
            error: null,
          }))
        }),
      )
      unsubs.push(
        await listen('llm-ready', () => {
          if (cancelled) return
          if (poll) {
            clearInterval(poll)
            poll = undefined
          }
          setS({ open: false, detail: '', error: null })
        }),
      )
      unsubs.push(
        await listen<string>('llm-bootstrap-error', (e) => {
          if (cancelled) return
          if (poll) {
            clearInterval(poll)
            poll = undefined
          }
          const msg =
            typeof e.payload === 'string' ? e.payload : String(e.payload ?? '启动失败')
          setS((prev) => ({ open: true, detail: prev.detail, error: msg }))
        }),
      )

      poll = setInterval(async () => {
        if (cancelled) return
        try {
          const alive = await invoke<boolean>('llm_child_alive')
          if (alive) {
            if (poll) clearInterval(poll)
            poll = undefined
            setS({ open: false, detail: '', error: null })
          }
        } catch {
          /* 尚未就绪 */
        }
      }, 800)
    }

    void run()

    return () => {
      cancelled = true
      unsubs.forEach((u) => {
        try {
          u()
        } catch {
          /* ignore */
        }
      })
      if (poll) clearInterval(poll)
    }
  }, [])

  return s
}
