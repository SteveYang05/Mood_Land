import type { LlmBootOverlay } from '../useLlmBootstrapGate'

type Props = {
  boot: LlmBootOverlay
}

export default function BootSplash({ boot }: Props) {
  if (!boot.open) return null

  return (
    <div className="boot-splash" role="alertdialog" aria-busy="true" aria-live="polite">
      <div className="boot-splash__panel">
        <h2 className="boot-splash__title">心境漫游</h2>
        <p className="boot-splash__subtitle">正在准备本机对话与伴读</p>
        {boot.error ? (
          <>
            <p className="boot-splash__error">{boot.error}</p>
            <p className="boot-splash__hint">
              可检查网络、代理或系统环境变量 <code>HF_TOKEN</code>（Hugging Face
              只读令牌）后，点击下方重试。
            </p>
            <button
              type="button"
              className="boot-splash__retry"
              onClick={() => window.location.reload()}
            >
              重新加载
            </button>
          </>
        ) : (
          <>
            <div className="boot-splash__detail">
              {boot.detail.split('\n').map((line, i) => (
                <p key={i}>{line.trim() ? line : '\u00a0'}</p>
              ))}
            </div>
            <p className="boot-splash__foot">
              窗口可能暂时无其他内容，属正常现象；请勿反复关闭，以免下载中断。
            </p>
            <div className="boot-splash__spinner" aria-hidden />
          </>
        )}
      </div>
    </div>
  )
}
