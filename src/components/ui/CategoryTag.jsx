export function CategoryTag({ name, categories }) {
  if (!name) return null
  const category = categories?.find((c) => c.name === name)
  const color = category?.color || 'var(--color-text-muted)'
  return (
    <span className="category-tag" style={{ '--tag-color': color }}>
      {name}
    </span>
  )
}
