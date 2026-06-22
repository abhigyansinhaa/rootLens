import { type FormEvent, useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AxiosError } from 'axios'
import { useAuth } from './AuthContext'
import { Button, Input } from '../../components/ui'
import { Database, MousePointerClick, TrendingUp, Eye, EyeOff } from 'lucide-react'

type FloatingStepProps = {
  step:  string
  title: string
  icon:  React.ElementType
  style: React.CSSProperties
}

function FloatingStep({ step, title, icon: Icon, style }: FloatingStepProps) {
  return (
    <div
      className="absolute hidden lg:flex glass-2 rounded-lg px-4 py-3 gap-3 items-center shadow-(--shadow-xl) border border-(--border-default) animate-float"
      style={style}
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[hsl(258_80%_58%/0.15)] border border-[hsl(258_80%_58%/0.3)] text-purple-400">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-purple-400">Step {step}</p>
        <p className="text-sm font-semibold text-(--text-1)">{title}</p>
      </div>
    </div>
  )
}

function StrengthBar({ password }: { password: string }) {
  const score = (() => {
    if (!password) return 0
    let s = 0
    if (password.length >= 8)  s += 40
    if (password.length >= 12) s += 20
    if (/[A-Z]/.test(password)) s += 15
    if (/[0-9]/.test(password)) s += 15
    if (/[^A-Za-z0-9]/.test(password)) s += 10
    return Math.min(100, s)
  })()

  const color =
    score < 40 ? 'bg-(--c-danger)' :
    score < 80 ? 'bg-(--c-warning)' :
                 'bg-(--c-success)'
  const label =
    score < 40 ? 'Weak' :
    score < 80 ? 'Fair' :
                 'Strong'

  if (!password) return null

  return (
    <div className="mt-2 space-y-1">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-(--surface-4)">
        <div className={`h-full transition-all duration-500 rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <p className="text-[10px] font-semibold text-(--text-3)">Password strength: {label}</p>
    </div>
  )
}

export function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPw,   setShowPw]   = useState(false)
  const [err,      setErr]      = useState<string | null>(null)
  const [busy,     setBusy]     = useState(false)
  const [mouse,    setMouse]    = useState({ x: 0, y: 0 })

  useEffect(() => {
    const move = (e: MouseEvent) => setMouse({
      x: (e.clientX / window.innerWidth  - 0.5) * 18,
      y: (e.clientY / window.innerHeight - 0.5) * 18,
    })
    window.addEventListener('mousemove', move)
    return () => window.removeEventListener('mousemove', move)
  }, [])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setErr(null)
    if (password.length < 8) { setErr('Password must be at least 8 characters.'); return }
    setBusy(true)
    try {
      await register(email, password)
      navigate('/', { replace: true })
    } catch (error) {
      if (error instanceof AxiosError) {
        const detail = error.response?.data?.detail
        if (typeof detail === 'string' && detail.length > 0) setErr(detail)
        else if (!error.response) setErr('Cannot reach backend. Make sure the API server is running.')
        else setErr('Could not create account. Please try again.')
      } else {
        setErr('Could not create account. Please try again.')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* ── Left Panel ── */}
      <div className="relative hidden w-1/2 overflow-hidden bg-(--surface-1) lg:flex lg:flex-col lg:items-center lg:justify-center border-r border-(--border-subtle)">
        {/* Mesh */}
        <div className="absolute inset-0 z-0" aria-hidden>
          <div className="absolute left-[-10%] top-[-10%] h-[50%] w-[50%] rounded-full bg-purple-600 opacity-[0.08] blur-[100px]" />
          <div className="absolute bottom-[-10%] right-[-10%] h-[50%] w-[50%] rounded-full bg-(--brand) opacity-[0.06] blur-[100px]" />
        </div>

        {/* Grid */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.04]" aria-hidden>
          <defs>
            <pattern id="grid2" width="48" height="48" patternUnits="userSpaceOnUse">
              <path d="M 48 0 L 0 0 0 48" fill="none" stroke="white" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid2)" />
        </svg>

        {/* Floating steps */}
        <div
          className="absolute inset-0 z-10"
          style={{ transform: `translate(${mouse.x}px, ${mouse.y}px)`, transition: 'transform 0.7s ease-out' }}
        >
          <FloatingStep step="1" title="Upload Dataset"  icon={Database}          style={{ top: '24%', left: '12%', animationDelay: '0s' }} />
          <FloatingStep step="2" title="Select Target"   icon={MousePointerClick} style={{ top: '48%', right: '10%', animationDelay: '0.9s' }} />
          <FloatingStep step="3" title="Get Insights"    icon={TrendingUp}        style={{ top: '68%', left: '14%', animationDelay: '1.8s' }} />
        </div>

        {/* Brand lockup */}
        <div className="relative z-20 flex flex-col items-center text-center animate-spring-in">
          <div className="glass-2 rounded-2xl p-10 shadow-(--shadow-2xl) border border-(--border-default)">
            <div className="mb-6 flex justify-center">
              <div className="rounded-xl bg-white p-5 shadow-(--shadow-lg)">
                <img src="/logo.png" alt="RootLens" className="h-16 w-auto object-contain" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-(--text-1) tracking-tight">Create your workspace</h1>
            <p className="mt-3 max-w-[260px] text-sm leading-relaxed text-(--text-2)">
              ML-powered root-cause analysis. No data science required.
            </p>
          </div>
        </div>
      </div>

      {/* ── Right Panel ── */}
      <div className="flex w-full flex-col items-center justify-center px-4 sm:px-8 lg:w-1/2 lg:px-16 xl:px-24">
        {/* Mobile logo */}
        <div className="mb-8 lg:hidden">
          <img src="/logo.png" alt="RootLens" className="h-10 w-auto object-contain" />
        </div>

        <div className="w-full max-w-sm animate-spring-up">
          <div className="mb-8 text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-purple-400">Get started free</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-(--text-1)">Create workspace</h2>
            <p className="mt-1.5 text-sm text-(--text-3)">Takes less than 60 seconds</p>
          </div>

          <div className="rounded-xl border border-(--border-default) bg-(--surface-1) p-6 shadow-(--shadow-xl)">
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="animate-slide-in-left delay-50">
                <Input
                  label="Email address"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                />
              </div>

              <div className="animate-slide-in-left delay-100">
                <Input
                  label="Password"
                  type={showPw ? 'text' : 'password'}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  rightIcon={
                    <button
                      type="button"
                      onClick={() => setShowPw(!showPw)}
                      className="text-(--text-3) hover:text-(--text-1) transition-colors"
                      aria-label={showPw ? 'Hide password' : 'Show password'}
                    >
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  }
                />
                <StrengthBar password={password} />
              </div>

              {err && (
                <div className="rounded-md border border-(--c-danger-border) bg-(--c-danger-bg) px-4 py-3 text-sm font-medium text-(--c-danger) animate-spring-in">
                  {err}
                </div>
              )}

              <div className="pt-1 animate-slide-in-left delay-150">
                <Button
                  type="submit"
                  loading={busy}
                  disabled={password.length > 0 && password.length < 8}
                  className="w-full h-11 text-sm"
                >
                  Create workspace
                </Button>
              </div>
            </form>
          </div>

          <p className="mt-6 text-center text-sm text-(--text-3) animate-fade-in delay-300">
            Already have a workspace?{' '}
            <Link className="font-semibold text-(--brand) transition-colors hover:brightness-110" to="/login">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
