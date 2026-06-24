/**
 * useTheme — dark/light mode toggle backed by localStorage + html[data-theme]
 */
import { useEffect, useState } from 'react'

export type Theme = 'dark' | 'light'

const STORAGE_KEY = 'rootLens:theme'

function getInitialTheme(): Theme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch { /* ignore */ }
  return 'dark'
}

function applyTheme(t: Theme) {
  document.documentElement.setAttribute('data-theme', t)
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme)

  useEffect(() => {
    applyTheme(theme)
    try { localStorage.setItem(STORAGE_KEY, theme) } catch { /* ignore */ }
  }, [theme])

  // Apply on first mount (before any React paint)
  useEffect(() => { applyTheme(getInitialTheme()) }, [])

  const toggle = () => setThemeState(t => t === 'dark' ? 'light' : 'dark')
  const setTheme = (t: Theme) => setThemeState(t)

  return { theme, toggle, setTheme }
}
