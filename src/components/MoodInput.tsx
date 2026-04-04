type Props = {
  value: string
  onChange: (v: string) => void
  disabled?: boolean
}

const PRESETS = ['平静', '有点焦虑', '疲惫', '兴奋难静下来', '低落']

export default function MoodInput({ value, onChange, disabled }: Props) {
  return (
    <div className="mood-input">
      <label htmlFor="mood">现在感觉怎么样？</label>
      <textarea
        id="mood"
        rows={3}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        placeholder="几个字就好，例如：脑子很吵，想静下来…"
      />
      <div className="presets">
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            className="preset-chip"
            disabled={disabled}
            onClick={() => onChange(p)}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  )
}
