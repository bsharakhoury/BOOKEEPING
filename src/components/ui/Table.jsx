import { useEffect, useRef, useState } from 'react'

const ROW_HEIGHT = 44 // matches the ≥44px touch-target guideline
const OVERSCAN = 8
const VIRTUALIZE_THRESHOLD = 500

function TableHead({ columns }) {
  return (
    <thead>
      <tr>
        {columns.map((col) => (
          <th key={col.key}>{col.label}</th>
        ))}
      </tr>
    </thead>
  )
}

function TableRow({ row, columns }) {
  return (
    <tr>
      {columns.map((col) => (
        <td key={col.key}>{col.render ? col.render(row) : row[col.key]}</td>
      ))}
    </tr>
  )
}

export function Table({ columns, rows, emptyMessage = 'Nothing here yet' }) {
  const containerRef = useRef(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(600)

  const shouldVirtualize = Boolean(rows) && rows.length > VIRTUALIZE_THRESHOLD

  useEffect(() => {
    if (!shouldVirtualize) return
    const el = containerRef.current
    if (!el) return

    const handleScroll = () => setScrollTop(el.scrollTop)
    const handleResize = () => setViewportHeight(el.clientHeight)
    handleResize()

    el.addEventListener('scroll', handleScroll)
    window.addEventListener('resize', handleResize)
    return () => {
      el.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleResize)
    }
  }, [shouldVirtualize])

  if (!rows || rows.length === 0) {
    return <div className="table-empty">{emptyMessage}</div>
  }

  if (!shouldVirtualize) {
    return (
      <table className="table">
        <TableHead columns={columns} />
        <tbody>
          {rows.map((row) => (
            <TableRow key={row.id} row={row} columns={columns} />
          ))}
        </tbody>
      </table>
    )
  }

  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN)
  const visibleCount = Math.ceil(viewportHeight / ROW_HEIGHT) + OVERSCAN * 2
  const endIndex = Math.min(rows.length, startIndex + visibleCount)
  const visibleRows = rows.slice(startIndex, endIndex)
  const topHeight = startIndex * ROW_HEIGHT
  const bottomHeight = (rows.length - endIndex) * ROW_HEIGHT

  return (
    <div>
      <div className="table-scroll" ref={containerRef}>
        <table className="table">
          <TableHead columns={columns} />
          <tbody>
            {topHeight > 0 && (
              <tr style={{ height: topHeight }} aria-hidden="true">
                <td colSpan={columns.length} />
              </tr>
            )}
            {visibleRows.map((row) => (
              <TableRow key={row.id} row={row} columns={columns} />
            ))}
            {bottomHeight > 0 && (
              <tr style={{ height: bottomHeight }} aria-hidden="true">
                <td colSpan={columns.length} />
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="table-virtualized-hint">
        {rows.length} rows · showing {startIndex + 1}–{endIndex}
      </p>
    </div>
  )
}
