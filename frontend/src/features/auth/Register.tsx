import { type FormEvent, useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AxiosError } from 'axios'
import { useAuth } from './AuthContext'
import { Button, Card, Input } from '../../components/ui'
import { Database, MousePointerClick, TrendingUp } from 'lucide-react'

function FloatingStep({ 
  step, 
  title, 
  icon: Icon, 
  delay,
  top,
  left,
  right
}: { 
  step: string;
  title: string; 
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
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500/30">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xs font-black uppercase tracking-wider text-indigo-400">Step {step}</p>
        <p className="text-sm font-bold text-white">{title}</p>
      </div>
    </div>
  )
}

export function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()

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

  // Calculate password strength (0-100)
  const getPasswordStrength = () => {
    if (!password) return 0
    let strength = 0
    if (password.length >= 8) strength += 40
    if (password.length >= 12) strength += 20
    if (/[A-Z]/.test(password)) strength += 15
    if (/[0-9]/.test(password)) strength += 15
    if (/[^A-Za-z0-9]/.test(password)) strength += 10
    return Math.min(100, strength)
  }
  
  const strength = getPasswordStrength()
  const strengthColor = strength < 40 ? 'bg-red-500' : strength < 80 ? 'bg-amber-500' : 'bg-emerald-500'

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setErr(null)
    if (password.length < 8) {
      setErr('Password must be at least 8 characters.')
      return
    }
    setBusy(true)
    try {
      await register(email, password)
      navigate('/', { replace: true })
    } catch (error) {
      if (error instanceof AxiosError) {
        const detail = error.response?.data?.detail
        if (typeof detail === 'string' && detail.length > 0) {
          setErr(detail)
        } else if (!error.response) {
          setErr('Cannot reach backend. Make sure the API server is running.')
        } else {
          setErr('Could not register. Please try again.')
        }
      } else {
        setErr('Could not register. Please try again.')
      }
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
          <FloatingStep step="1" title="Upload Dataset" icon={Database} delay="200ms" top="25%" left="15%" />
          <FloatingStep step="2" title="Select Target" icon={MousePointerClick} delay="400ms" top="45%" right="15%" />
          <FloatingStep step="3" title="Get Insights" icon={TrendingUp} delay="600ms" top="65%" left="20%" />
        </div>

        {/* Central Brand */}
        <div className="relative z-20 flex flex-col items-center text-center animate-fade-in-scale">
          <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-brand-400 via-brand-600 to-slate-900 shadow-2xl shadow-brand-500/30 ring-1 ring-white/20 animate-pulse-glow">
            <span className="font-mono text-5xl font-black text-white">R</span>
          </div>
          <h1 className="mt-8 text-4xl font-black tracking-tight text-white">Spin up a workspace</h1>
          <p className="mt-4 max-w-md text-lg leading-relaxed text-slate-300">
            Automated ML, SHAP-driven explainability, and actionable KPIs in minutes.
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
              <p className="text-xs font-black uppercase tracking-[0.2em] text-brand-500 mb-2">New Account</p>
              <h2 className="text-2xl font-black tracking-tight text-[var(--text-1)]">Create Workspace</h2>
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
                  minLength={8}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-[var(--surface-1)] transition-colors focus:bg-[var(--surface-2)]"
                />
                {password.length > 0 && (
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--border-1)]">
                    <div 
                      className={`h-full transition-all duration-300 ${strengthColor}`} 
                      style={{ width: `${strength}%` }}
                    />
                  </div>
                )}
                {password.length > 0 && password.length < 8 && (
                  <p className="mt-1 text-xs text-red-500">Minimum 8 characters required</p>
                )}
              </div>

              {err && (
                <div className="animate-fade-in-up rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-600 dark:text-red-400">
                  {err}
                </div>
              )}

              <div className="pt-2 animate-slide-in-left delay-300">
                <Button type="submit" disabled={busy || (password.length > 0 && password.length < 8)} className="w-full h-12 text-base shadow-lg shadow-brand-500/20">
                  {busy ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Creating…
                    </span>
                  ) : (
                    'Create Workspace'
                  )}
                </Button>
              </div>
            </form>

            <p className="mt-8 text-center text-sm text-[var(--text-3)] animate-fade-in-up delay-400">
              Already have a workspace?{' '}
              <Link className="font-bold text-brand-600 transition-colors hover:text-brand-500 dark:text-brand-400" to="/login">
                Sign in
              </Link>
            </p>
          </Card>
        </div>
      </div>
    </div>
  )
}
