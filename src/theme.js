export const palette = {
  navy: '#1C2940',
  sage: '#4A7C59',
  teal: '#2E8B8B',
  terracotta: '#C0522A',
  amber: '#C08B2A',
  violet: '#6B4FA0',
  ink: '#1C1F1A',
  background: '#F5F4EF',
  white: '#FDFDF8',
  border: '#D8D6CE'
}

export const THEME_OPTIONS = ['system', 'light', 'dark']

export function applyTheme(theme) {
  const root = document.documentElement
  if (theme === 'light' || theme === 'dark') {
    root.setAttribute('data-theme', theme)
  } else {
    root.removeAttribute('data-theme')
  }
}
