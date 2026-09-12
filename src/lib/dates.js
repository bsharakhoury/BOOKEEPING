export function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

export function monthKey(dateStr) {
  return String(dateStr).slice(0, 7)
}

export function formatDate(dateStr) {
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) return dateStr
  return date.toLocaleDateString('en-AE', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function monthLabel(key) {
  const [year, month] = String(key).split('-').map(Number)
  const date = new Date(year, (month || 1) - 1, 1)
  return date.toLocaleDateString('en-AE', { month: 'short', year: 'numeric' })
}

export function addMonths(dateStr, count) {
  const date = new Date(dateStr)
  date.setMonth(date.getMonth() + count)
  return date.toISOString().slice(0, 10)
}

export function addDays(dateStr, count) {
  const date = new Date(dateStr)
  date.setDate(date.getDate() + count)
  return date.toISOString().slice(0, 10)
}

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate()
}

// Inclusive [start, end] date range for the calendar month containing `monthKeyStr` ('YYYY-MM').
export function monthRange(monthKeyStr) {
  const [year, month] = monthKeyStr.split('-').map(Number)
  return { start: `${monthKeyStr}-01`, end: `${monthKeyStr}-${String(daysInMonth(year, month)).padStart(2, '0')}` }
}

// Inclusive [start, end] date range for the calendar quarter containing `monthKeyStr`.
export function quarterRange(monthKeyStr) {
  const [year, month] = monthKeyStr.split('-').map(Number)
  const quarterStartMonth = Math.floor((month - 1) / 3) * 3 + 1
  const quarterEndMonth = quarterStartMonth + 2
  return {
    start: `${year}-${String(quarterStartMonth).padStart(2, '0')}-01`,
    end: `${year}-${String(quarterEndMonth).padStart(2, '0')}-${String(daysInMonth(year, quarterEndMonth)).padStart(2, '0')}`
  }
}

// Inclusive [start, end] date range from Jan 1 through the end of the month containing
// `monthKeyStr` — year-to-date as of that month.
export function ytdRange(monthKeyStr) {
  const [year] = monthKeyStr.split('-').map(Number)
  const { end } = monthRange(monthKeyStr)
  return { start: `${year}-01-01`, end }
}

// The `count` most recent month keys ending with (and including) the month containing `today`,
// oldest first.
export function lastNMonthKeys(today, count) {
  const keys = []
  let key = monthKey(today)
  for (let i = 0; i < count; i++) {
    keys.unshift(key)
    key = monthKey(addMonths(`${key}-01`, -1))
  }
  return keys
}

// All month keys from `startKey` through `endKey` inclusive, oldest first. Swaps the two if
// given out of order.
export function monthKeysInRange(startKey, endKey) {
  let [start, end] = startKey <= endKey ? [startKey, endKey] : [endKey, startKey]
  const keys = []
  let key = start
  while (key <= end) {
    keys.push(key)
    key = monthKey(addMonths(`${key}-01`, 1))
  }
  return keys
}

const MONTH_NAMES = {
  january: '01', february: '02', march: '03', april: '04', may: '05', june: '06',
  july: '07', august: '08', september: '09', october: '10', november: '11', december: '12'
}

const LONG_DATE_RE = /(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i

// Finds a "10 August 2026" (optionally "Monday, 10 August 2026, 1:26 pm") date anywhere in a
// string — the in-sentence format used by Mashreq SMS alerts — and returns it as 'YYYY-MM-DD'.
export function parseLongDate(text) {
  const match = LONG_DATE_RE.exec(String(text))
  if (!match) return null
  const [, day, monthName, year] = match
  const month = MONTH_NAMES[monthName.toLowerCase()]
  return `${year}-${month}-${String(day).padStart(2, '0')}`
}

// True when a pasted line is ONLY a date (an optional weekday prefix, then the long date, then
// nothing else) — used to detect a date "header" line that following SMS lines inherit.
export function isDateOnlyLine(line) {
  const trimmed = String(line).trim().replace(/[.:]$/, '')
  if (!trimmed) return false
  const withoutWeekday = trimmed.replace(/^[A-Za-z]+,\s*/, '')
  const match = LONG_DATE_RE.exec(withoutWeekday)
  if (!match || match.index !== 0) return false
  return withoutWeekday.slice(match[0].length).trim() === ''
}
