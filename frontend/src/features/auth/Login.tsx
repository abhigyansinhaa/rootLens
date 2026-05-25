import { type FormEvent, useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { Button, Card, Input } from '../../components/ui'
import { Activity, ShieldCheck, Zap } from 'lucide-react'

function FloatingCard({ 
  title, 
  value, 
  icon: Icon, 
  delay,
  top,
  left,
  right
}: { 
  title: string; 
  value: string; 
  icon: React.ElementType; 
  delay: string;
  top?: string;
  left?: string;
  right?: string;
}) {
  return (
    <div 
      className={`absolute hidden lg:flex glass rounded-xl p-4 gap-4 items-center shadow-2xl ${delay} animate-fade-in-up`}
      style={{ top, left, right, animationDelay: delay }}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-500/20 text-brand-300 ring-1 ring-brand-500/30">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-slate-300">{title}</p>
        <p className="text-xl font-bold tabular-nums text-white">{value}</p>
      </div>
    </div>
  )
}

export function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({
        x: (e.clientX / window.innerWidth - 0.5) * 20,
        y: (e.clientY / window.innerHeight - 0.5) * 20,
      })
    }
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
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
      {/* Left Panel - Brand Showcase */}
      <div className="relative hidden w-1/2 overflow-hidden bg-slate-950 lg:flex lg:flex-col lg:items-center lg:justify-center">
        {/* Animated Background Mesh */}
        <div className="absolute inset-0 z-0 opacity-40">
          <div className="absolute -left-[10%] top-[-10%] h-[50%] w-[50%] rounded-full bg-brand-600/30 blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[-10%] h-[50%] w-[50%] rounded-full bg-indigo-600/30 blur-[120px]" />
        </div>

        {/* Floating Cards (Parallax) */}
        <div 
          className="absolute inset-0 z-10 transition-transform duration-700 ease-out"
          style={{ transform: `translate(${mousePos.x}px, ${mousePos.y}px)` }}
        >
          <FloatingCard title="Churn Detected" value="12.4%" icon={Activity} delay="200ms" top="25%" left="15%" />
          <FloatingCard title="Key Drivers" value="3 Identified" icon={Zap} delay="400ms" top="65%" right="15%" />
          <FloatingCard title="Model Health" value="Stable" icon={ShieldCheck} delay="600ms" top="45%" left="10%" />
        </div>

        {/* Central Brand */}
        <div className="relative z-20 flex flex-col items-center text-center animate-fade-in-scale">
          <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-brand-400 via-brand-600 to-slate-900 shadow-2xl shadow-brand-500/30 ring-1 ring-white/20 animate-pulse-glow">
            <span className="font-mono text-5xl font-black text-white">R</span>
          </div>
          <h1 className="mt-8 text-4xl font-black tracking-tight text-white">RCA Cockpit</h1>
          <p className="mt-4 max-w-md text-lg leading-relaxed text-slate-300">
            Decision-ready root-cause insights and actionable KPIs for operators.
          </p>
        </div>
      </div>

      {/* Right Panel - Auth Form */}
      <div className="flex w-full flex-col justify-center px-4 sm:px-6 lg:w-1/2 lg:px-20 xl:px-32 relative">
        <div className="absolute inset-0 z-0 bg-[var(--app-bg)] opacity-90 lg:hidden" />
        
        <div className="relative z-10 w-full max-w-sm mx-auto">
          <div className="mb-10 text-center lg:hidden">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 via-brand-600 to-slate-900 shadow-md ring-1 ring-white/20">
              <span className="font-mono text-xl font-black text-white">R</span>
            </div>
            <h2 className="mt-4 text-2xl font-black text-[var(--text-1)]">RCA Cockpit</h2>
          </div>

          <Card padding="xl" tone="default" elevated className="glass border-t-brand-500 border-t-2 animate-fade-in-up">
            <div className="mb-8">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-brand-500 mb-2">Welcome Back</p>
              <h2 className="text-2xl font-black tracking-tight text-[var(--text-1)]">Operator Login</h2>
            </div>

            <form onSubmit={onSubmit} className="space-y-5">
              <div className="animate-slide-in-left delay-100">
                <Input
                  label="Email Address"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-[var(--surface-1)] transition-colors focus:bg-[var(--surface-2)]"
                />
              </div>
              
              <div className="animate-slide-in-left delay-200">
                <Input
                  label="Password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-[var(--surface-1)] transition-colors focus:bg-[var(--surface-2)]"
                />
              </div>

              {err && (
                <div className="animate-fade-in-up rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-600 dark:text-red-400">
                  {err}
                </div>
              )}

              <div className="pt-2 animate-slide-in-left delay-300">
                <Button type="submit" disabled={busy} className="w-full h-12 text-base shadow-lg shadow-brand-500/20">
                  {busy ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Signing in…
                    </span>
                  ) : (
                    'Sign in to Workspace'
                  )}
                </Button>
              </div>
            </form>

            <p className="mt-8 text-center text-sm text-[var(--text-3)] animate-fade-in-up delay-400">
              Need to create a workspace?{' '}
              <Link className="font-bold text-brand-600 transition-colors hover:text-brand-500 dark:text-brand-400" to="/register">
                Sign up
              </Link>
            </p>
          </Card>
        </div>
      </div>
    </div>
  )
}
