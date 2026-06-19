/**
 * ThemeToggle — sun/moon button for header; driven by useTheme hook.
 */
import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../hooks/useTheme'

export function ThemeToggle() {
  const { theme, toggle } = useTheme()
  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      onClick={toggle}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="relative rounded-[var(--radius-md)] p-2 text-[var(--text-3)] hover:bg-[var(--surface-2)] hover:text-[var(--text-1)] transition-colors"
    >
      <span
        className="absolute inset-0 flex items-center justify-center transition-all duration-300"
        style={{ opacity: isDark ? 1 : 0, transform: isDark ? 'rotate(0deg) scale(1)' : 'rotate(90deg) scale(0)' }}
        aria-hidden={!isDark}
      >
        <Moon className="h-[18px] w-[18px]" />
      </span>
      <span
        className="flex items-center justify-center transition-all duration-300"
        style={{ opacity: isDark ? 0 : 1, transform: isDark ? 'rotate(-90deg) scale(0)' : 'rotate(0deg) scale(1)' }}
        aria-hidden={isDark}
      >
        <Sun className="h-[18px] w-[18px]" />
      </span>
    </button>
  )
}
