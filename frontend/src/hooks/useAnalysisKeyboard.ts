import { useEffect, useCallback } from 'react'

type Options = {
  onOpenCopilot?: () => void
  onFocusSearch?: () => void
  enabled?: boolean
}

export function useAnalysisKeyboard({ onOpenCopilot, onFocusSearch, enabled = true }: Options) {
  const handler = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      if (e.key === 'c' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        onOpenCopilot?.()
      }
      if (e.key === '/' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        onFocusSearch?.()
      }
    },
    [enabled, onOpenCopilot, onFocusSearch],
  )

  useEffect(() => {
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handler])
}

export function scrollToSection(sectionId: string) {
  const el = document.getElementById(sectionId) ?? document.querySelector(`[id="${sectionId}"]`)
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  el.classList.add('section-highlight')
  window.setTimeout(() => el.classList.remove('section-highlight'), 600)
}
