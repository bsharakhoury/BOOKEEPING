export function Chip({ label, active = false, onClick }) {
  return (
    <button type="button" className="chip" aria-pressed={active} onClick={onClick}>
      {label}
    </button>
  )
}
