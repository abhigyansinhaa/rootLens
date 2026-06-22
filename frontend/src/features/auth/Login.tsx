import { type FormEvent, useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { Button, Input } from '../../components/ui'
import { Activity, ShieldCheck, Zap, Eye, EyeOff } from 'lucide-react'

type FloatingStatProps = {
  title: string
  value: string
  icon:  React.ElementType
  style: React.CSSProperties
}

function FloatingStat({ title, value, icon: Icon, style }: FloatingStatProps) {
  return (
    <div
      className="absolute hidden lg:flex glass-2 rounded-lg px-4 py-3 gap-3 items-center shadow-(--shadow-xl) border border-(--border-default) animate-float"
      style={style}
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-(--brand-dim) border border-(--border-brand) text-(--brand)">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-(--text-3)">{title}</p>
        <p className="text-base font-bold text-(--text-1) font-mono tabular-nums">{value}</p>
      </div>
    </div>
  )
}

export function Login() {
  const { login } = useAuth()
  const navigate  = useNavigate()
  const location  = useLocation()
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/'

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
    setBusy(true)
    try {
      await login(email, password)
      navigate(from, { replace: true })
    } catch {
      setErr('Invalid email or password.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* ── Left Panel — Brand ── */}
      <div className="relative hidden w-1/2 overflow-hidden bg-(--surface-1) lg:flex lg:flex-col lg:items-center lg:justify-center border-r border-(--border-subtle)">
        {/* Mesh gradient */}
        <div className="absolute inset-0 z-0" aria-hidden>
          <div className="absolute -left-[15%] top-[-15%] h-[55%] w-[55%] rounded-full bg-(--brand) opacity-[0.08] blur-[100px]" />
          <div className="absolute bottom-[-10%] right-[-10%] h-[50%] w-[50%] rounded-full bg-purple-600 opacity-[0.07] blur-[100px]" />
          <div className="absolute left-[30%] top-[60%] h-[35%] w-[35%] rounded-full bg-cyan-500 opacity-[0.05] blur-[80px]" />
        </div>

        {/* Grid lines */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.04]" aria-hidden>
          <defs>
            <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">
              <path d="M 48 0 L 0 0 0 48" fill="none" stroke="white" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>

        {/* Floating stat cards (parallax) */}
        <div
          className="absolute inset-0 z-10"
          style={{ transform: `translate(${mouse.x}px, ${mouse.y}px)`, transition: 'transform 0.7s ease-out' }}
        >
          <FloatingStat title="Churn Detected"  value="12.4%"         icon={Activity}    style={{ top: '22%', left: '12%', animationDelay: '0s' }} />
          <FloatingStat title="Key Drivers"     value="3 Found"       icon={Zap}         style={{ top: '62%', right: '10%', animationDelay: '0.8s' }} />
          <FloatingStat title="Model Integrity" value="98.2% AUC"     icon={ShieldCheck} style={{ top: '42%', left: '8%', animationDelay: '1.6s' }} />
        </div>

        {/* Center brand lockup */}
        <div className="relative z-20 flex flex-col items-center text-center animate-spring-in">
          <div className="glass-2 rounded-2xl p-10 shadow-(--shadow-2xl) border border-(--border-default)">
            <div className="mb-6 flex justify-center">
              <div className="rounded-xl bg-white p-5 shadow-(--shadow-lg)">
                <img src="/logo.png" alt="RootLens" className="h-16 w-auto object-contain" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-(--text-1) tracking-tight">
              Root-Cause Intelligence
            </h1>
            <p className="mt-3 max-w-[280px] text-sm leading-relaxed text-(--text-2)">
              Upload your data. Identify root causes. Quantify risk and act with confidence.
            </p>

            {/* Animated separator */}
            <div className="mt-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-(--border-subtle)" />
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-(--text-4)">Powered by SHAP</span>
              <div className="h-px flex-1 bg-(--border-subtle)" />
            </div>
          </div>
        </div>
      </div>

      {/* ── Right Panel — Auth Form ── */}
      <div className="flex w-full flex-col items-center justify-center px-4 sm:px-8 lg:w-1/2 lg:px-16 xl:px-24">
        {/* Mobile logo */}
        <div className="mb-8 lg:hidden">
          <img src="/logo.png" alt="RootLens" className="h-10 w-auto object-contain" />
        </div>

        <div className="w-full max-w-sm animate-spring-up">
          {/* Header */}
          <div className="mb-8 text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-(--brand)">Welcome back</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-(--text-1)">Sign in to workspace</h2>
            <p className="mt-1.5 text-sm text-(--text-3)">Enter your credentials to continue</p>
          </div>

          {/* Form card */}
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
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  rightIcon={
                    <button
                      type="button"
                      onClick={() => setShowPw(!showPw)}
                      className="flex items-center text-(--text-3) hover:text-(--text-1) transition-colors"
                      aria-label={showPw ? 'Hide password' : 'Show password'}
                    >
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  }
                />
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
                  className="w-full h-11 text-sm"
                >
                  Sign in to workspace
                </Button>
              </div>
            </form>
          </div>

          <p className="mt-6 text-center text-sm text-(--text-3) animate-fade-in delay-300">
            No workspace yet?{' '}
            <Link
              className="font-semibold text-(--brand) transition-colors hover:brightness-110"
              to="/register"
            >
              Create account
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
