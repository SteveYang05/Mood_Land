import VoiceDictationButton from './VoiceDictationButton'

type Props = {
  value: string
  onChange: (v: string) => void
  disabled?: boolean
  /** 单屏紧凑布局 */
  compact?: boolean
}

const PRESETS = ['平静', '有点焦虑', '疲惫', '兴奋难静下来', '低落']

export default function MoodInput({
  value,
  onChange,
  disabled,
  compact = false,
}: Props) {
  return (
    <div className={compact ? 'mood-input mood-input--compact' : 'mood-input'}>
      <label htmlFor="mood">此刻感受</label>
      <div className="mood-input__field">
        <textarea
          id="mood"
          rows={compact ? 2 : 3}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          placeholder="几个字即可，如：脑子很吵…"
        />
        <VoiceDictationButton
          disabled={disabled}
          onAppend={(t) => onChange(value ? `${value} ${t}`.trim() : t)}
        />
      </div>
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
