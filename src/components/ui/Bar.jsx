export function Bar({ value, max, color = 'var(--color-sage)' }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className="bar">
      <div className="bar__fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  )
}
