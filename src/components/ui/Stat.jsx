export function Stat({ label, value, tone = 'expense' }) {
  return (
    <div className="stat">
      <div className="stat__label">{label}</div>
      <div className={`money money--${tone}`}>{value}</div>
    </div>
  )
}
