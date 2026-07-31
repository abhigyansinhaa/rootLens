import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ShieldCheck,
  ArrowRight,
  ChevronDown,
  Cpu,
  Layers,
  AlertTriangle,
  GitBranch,
  Clock,
  Sparkles,
  CheckCircle2,
  FileSpreadsheet,
  Moon,
  Sun,
  Lock,
} from 'lucide-react'
import { Button, Card, CardEyebrow, StatusBadge } from '../../components/ui'
import { ConfidenceArc } from '../../components/kpi'

export function LandingPage() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [openFaq, setOpenFaq] = useState<number | null>(0)
  const [activeTab, setActiveTab] = useState<'impact' | 'signals'>('impact')

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    if (next === 'light') {
      document.documentElement.setAttribute('data-theme', 'light')
      document.documentElement.classList.remove('dark')
    } else {
      document.documentElement.removeAttribute('data-theme')
      document.documentElement.classList.add('dark')
    }
  }

  const faqs = [
    {
      q: 'Is rootLens performing true causal inference?',
      a: 'No, and we say so explicitly on every report. rootLens uses SHAP (SHapley Additive exPlanations) to measure feature contributions to the trained model. Our counterfactual what-if simulations use "SHAP-zeroing" approximations to estimate marginal lift — always labeled as association, not true randomized experimental causality.',
    },
    {
      q: 'What happens if my dataset has missing values or noisy columns?',
      a: 'rootLens is engineered to fail gracefully, not silently. Numerical missing values are median-imputed, mid-cardinality categoricals use out-of-fold target encoding, and high-cardinality ID-like columns (>300 levels) are automatically dropped with an explicit governance warning rather than crashing or leaking target data.',
    },
    {
      q: 'How does the confidence scoring system work?',
      a: 'Confidence is layered independently across drivers, counterfactuals, and overall model reliability. Driver confidence blends rank position, cross-validation fold variance (cv_std), column null ratios (penalized above 35%), and direction agreement between SHAP signs and raw Pearson correlation.',
    },
    {
      q: 'Is my dataset data secure and private?',
      a: 'Yes. All data processing occurs locally within your rootLens deployment server. No raw dataset rows or proprietary columns are transmitted to external third-party API providers.',
    },
    {
      q: 'What data formats and task types are supported?',
      a: 'We support CSV and Parquet files for both Binary Classification (e.g. churn, default, fraud) and Regression targets (e.g. revenue, cost, LTV, duration).',
    },
  ]

  return (
    <div className="min-h-screen bg-(--app-bg) text-(--text-1) font-sans selection:bg-(--brand)/30">
      {/* ─────────────────────────────────────────────────────────────────────────────
         1. NAVBAR
         ───────────────────────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-(--app-bg)/85 border-b border-(--border-subtle) transition-colors">
        <div className="max-w-(--page-max-width) mx-auto px-4 sm:px-6 h-(--app-header-height) flex items-center justify-between gap-4">
          <Link to="/landing" className="flex items-center gap-2.5 group">
            <div className="h-8 w-8 rounded-lg bg-(--brand)/15 border border-(--brand)/30 flex items-center justify-center text-(--brand) group-hover:scale-105 transition-transform">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <span className="font-display text-xl font-semibold tracking-tight text-(--text-1)">
              root<span className="text-(--brand)">Lens</span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-(--text-2)" aria-label="Main Navigation">
            <a href="#differentiators" className="hover:text-(--text-1) transition-colors">
              Differentiators
            </a>
            <a href="#how-it-works" className="hover:text-(--text-1) transition-colors">
              How it works
            </a>
            <a href="#trust" className="hover:text-(--text-1) transition-colors">
              Trust &amp; confidence
            </a>
            <a href="#faq" className="hover:text-(--text-1) transition-colors">
              FAQ
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-lg text-(--text-3) hover:text-(--text-1) hover:bg-(--surface-2) transition-colors"
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <Button to="/upload" size="sm" variant="primary">
              Try it on your data <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        </div>
      </header>

      <main id="main-content">
        {/* ─────────────────────────────────────────────────────────────────────────────
           2. HERO SECTION
           ───────────────────────────────────────────────────────────────────────────── */}
        <section className="relative pt-16 pb-20 sm:pt-24 sm:pb-32 overflow-hidden border-b border-(--border-subtle)">
          {/* Subtle background glow */}
          <div className="pointer-events-none absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-(--brand)/5 blur-[120px] rounded-full" />

          <div className="max-w-(--page-max-width) mx-auto px-4 sm:px-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
              
              {/* Left Column: Headlines & CTAs */}
              <div className="lg:col-span-7 space-y-6">
                <div className="inline-flex items-center gap-2 rounded-full border border-(--border-default) bg-(--surface-2) px-3 py-1 text-xs font-medium text-(--text-2)">
                  <Sparkles className="h-3.5 w-3.5 text-(--brand)" />
                  <span>Forensic Root-Cause Intelligence</span>
                </div>

                <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-semibold text-(--text-1) leading-[1.12] tracking-tight">
                  Know why.<br />
                  <span className="text-(--brand) italic font-normal">Not just what.</span>
                </h1>

                <p className="text-base sm:text-lg text-(--text-2) leading-relaxed max-w-xl">
                  Find out what&apos;s actually driving churn, cost, or risk — with explicit confidence attached to every driver, not just rank.
                </p>

                <div className="flex flex-wrap items-center gap-4 pt-2">
                  <Button to="/upload" size="lg" variant="primary">
                    Try it on your data
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                  <a
                    href="#trust"
                    className="inline-flex items-center justify-center h-12 px-6 text-sm font-medium rounded-xl border border-(--border-default) bg-(--surface-2) text-(--text-1) hover:bg-(--surface-3) hover:border-(--border-strong) transition-colors"
                  >
                    See confidence scoring
                  </a>
                </div>

                {/* Social proof note */}
                <div className="flex items-center gap-2 pt-4 text-xs text-(--text-3)">
                  <CheckCircle2 className="h-4 w-4 text-(--brand) shrink-0" />
                  <span>Built for analysts who need to show their work.</span>
                </div>
              </div>

              {/* Right Column: Hero Visual (Live Driver Card Demo) */}
              <div className="lg:col-span-5">
                <Card padding="lg" tone="strong" elevated className="border border-(--border-default) shadow-(--shadow-xl)">
                  <div className="flex items-center justify-between pb-4 border-b border-(--border-subtle)">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="h-4 w-4 text-(--brand)" />
                      <span className="text-xs font-mono font-semibold text-(--text-2)">telco_churn_q3.csv</span>
                    </div>
                    <StatusBadge tone="success" dot className="text-[10px]">
                      Validated
                    </StatusBadge>
                  </div>

                  {/* Card Tab switcher */}
                  <div className="flex items-center gap-1 bg-(--surface-3) p-1 rounded-lg mt-4">
                    <button
                      type="button"
                      onClick={() => setActiveTab('impact')}
                      className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                        activeTab === 'impact'
                          ? 'bg-(--surface-1) text-(--text-1) shadow-xs'
                          : 'text-(--text-3) hover:text-(--text-2)'
                      }`}
                    >
                      Top Driver #1
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('signals')}
                      className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                        activeTab === 'signals'
                          ? 'bg-(--surface-1) text-(--text-1) shadow-xs'
                          : 'text-(--text-3) hover:text-(--text-2)'
                      }`}
                    >
                      Disagreement Signals
                    </button>
                  </div>

                  {activeTab === 'impact' ? (
                    <div className="space-y-4 pt-4 animate-fade-in">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardEyebrow>Rank #1 Root Cause</CardEyebrow>
                          <h3 className="text-lg font-bold text-(--text-1) mt-0.5">Contract: Month-to-Month</h3>
                        </div>
                        <div className="flex items-center gap-1.5 bg-(--surface-3) px-2.5 py-1 rounded-lg">
                          <ConfidenceArc cvRatio={0.08} tier="high" size={24} />
                          <span className="text-xs font-semibold text-(--confidence-high)">High Conf</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-1">
                        <div className="p-3 rounded-lg bg-(--surface-1) border border-(--border-subtle)">
                          <span className="text-[10px] uppercase font-bold text-(--text-3)">Marginal Lift</span>
                          <p className="text-lg font-bold text-(--critical) tabular-nums mt-0.5">+18.4%</p>
                        </div>
                        <div className="p-3 rounded-lg bg-(--surface-1) border border-(--border-subtle)">
                          <span className="text-[10px] uppercase font-bold text-(--text-3)">Revenue at Risk</span>
                          <p className="text-lg font-bold text-(--text-1) tabular-nums mt-0.5">$142,500</p>
                        </div>
                      </div>

                      {/* SHAP impact bar */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs text-(--text-2)">
                          <span>SHAP Contribution</span>
                          <span className="font-mono text-(--brand)">+0.428 (High)</span>
                        </div>
                        <div className="h-2 w-full bg-(--surface-3) rounded-full overflow-hidden">
                          <div className="h-full bg-(--brand) rounded-full w-[82%]" />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3 pt-4 animate-fade-in">
                      <CardEyebrow>Correlation vs SHAP Audit</CardEyebrow>
                      <div className="p-3 rounded-lg bg-(--warning-bg) border border-(--warning-border) text-xs text-(--warning) space-y-1">
                        <div className="flex items-center gap-1.5 font-bold">
                          <AlertTriangle className="h-4 w-4 shrink-0" />
                          <span>SHAP &amp; Pearson Direction Alignment</span>
                        </div>
                        <p className="leading-relaxed">
                          SHAP attributes +18.4% risk lift, matching raw Pearson correlation (+0.38). Signals agree with domain truth.
                        </p>
                      </div>

                      <div className="p-3 rounded-lg bg-(--surface-1) border border-(--border-subtle) text-xs space-y-1.5">
                        <div className="flex justify-between text-(--text-2)">
                          <span>Fold Stability (cv_std):</span>
                          <span className="font-mono text-(--success)">0.024 (Very Stable)</span>
                        </div>
                        <div className="flex justify-between text-(--text-2)">
                          <span>Null Rate Penalty:</span>
                          <span className="font-mono text-(--text-1)">0.0% (Clean Column)</span>
                        </div>
                      </div>
                    </div>
                  )}
                </Card>
              </div>

            </div>
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────────────────────────
           4. BENEFITS BENTO GRID
           ───────────────────────────────────────────────────────────────────────────── */}
        <section id="differentiators" className="py-20 sm:py-28 border-b border-(--border-subtle)">
          <div className="max-w-(--page-max-width) mx-auto px-4 sm:px-6 space-y-12">
            
            <div className="text-center max-w-2xl mx-auto space-y-3">
              <CardEyebrow>Built For Rigor</CardEyebrow>
              <h2 className="font-display text-3xl sm:text-4xl font-semibold text-(--text-1)">
                Six real differentiators. Zero fluff.
              </h2>
              <p className="text-sm sm:text-base text-(--text-2)">
                Every feature in rootLens was built to answer the questions a senior analyst or data manager asks before presenting to executive leadership.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              
              {/* Card 1 */}
              <Card padding="lg" tone="default" hover className="space-y-4">
                <div className="h-10 w-10 rounded-xl bg-(--brand)/15 text-(--brand) flex items-center justify-center">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-bold text-(--text-1)">Never tells you it&apos;s sure when it isn&apos;t</h3>
                <p className="text-xs sm:text-sm text-(--text-2) leading-relaxed">
                  Every driver receives an independent confidence score blending rank position, cross-validation fold stability, column null ratios, and correlation agreement.
                </p>
              </Card>

              {/* Card 2 */}
              <Card padding="lg" tone="default" hover className="space-y-4">
                <div className="h-10 w-10 rounded-xl bg-(--warning-bg) text-(--warning) flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-bold text-(--text-1)">Flags its own disagreements</h3>
                <p className="text-xs sm:text-sm text-(--text-2) leading-relaxed">
                  When the model&apos;s SHAP ranking and simple Pearson correlation point in opposite directions, the report explicitly surfaces the discrepancy instead of hiding it.
                </p>
              </Card>

              {/* Card 3 */}
              <Card padding="lg" tone="default" hover className="space-y-4">
                <div className="h-10 w-10 rounded-xl bg-(--info-bg) text-(--info) flex items-center justify-center">
                  <GitBranch className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-bold text-(--text-1)">Built to fail gracefully, not silently</h3>
                <p className="text-xs sm:text-sm text-(--text-2) leading-relaxed">
                  Training, explanation, and business-impact estimation all feature 4-tier fallback chains. Messy real-world datasets degrade to an honest answer rather than crashing.
                </p>
              </Card>

              {/* Card 4 */}
              <Card padding="lg" tone="default" hover className="space-y-4">
                <div className="h-10 w-10 rounded-xl bg-(--brand)/15 text-(--brand) flex items-center justify-center">
                  <Layers className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-bold text-(--text-1)">What-if, without pretending it&apos;s causal</h3>
                <p className="text-xs sm:text-sm text-(--text-2) leading-relaxed">
                  Our driver-intervention simulator uses additivity-based SHAP-zeroing counterfactuals — always explicitly labeled as approximations, never dressed up as a guaranteed outcome.
                </p>
              </Card>

              {/* Card 5 */}
              <Card padding="lg" tone="default" hover className="space-y-4">
                <div className="h-10 w-10 rounded-xl bg-(--success-bg) text-(--success) flex items-center justify-center">
                  <Lock className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-bold text-(--text-1)">Governance built in, not bolted on</h3>
                <p className="text-xs sm:text-sm text-(--text-2) leading-relaxed">
                  Automatic feature registry coverage checks, ID-like leakage detection, and reliability tiering perform the checks a data team would normally do by hand.
                </p>
              </Card>

              {/* Card 6 */}
              <Card padding="lg" tone="default" hover className="space-y-4">
                <div className="h-10 w-10 rounded-xl bg-(--brand)/15 text-(--brand) flex items-center justify-center">
                  <Clock className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-bold text-(--text-1)">Time-aware where it matters</h3>
                <p className="text-xs sm:text-sm text-(--text-2) leading-relaxed">
                  When a datetime column is present, chronological walk-forward validation (<code className="font-mono text-xs">TimeSeriesSplit</code>) automatically replaces random CV to prevent future-leakage.
                </p>
              </Card>

            </div>
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────────────────────────
           5. HOW IT WORKS (3 STEPS)
           ───────────────────────────────────────────────────────────────────────────── */}
        <section id="how-it-works" className="py-20 sm:py-28 border-b border-(--border-subtle) bg-(--surface-1)/40">
          <div className="max-w-(--page-max-width) mx-auto px-4 sm:px-6 space-y-16">
            
            <div className="text-center max-w-2xl mx-auto space-y-3">
              <CardEyebrow>End-To-End Workflow</CardEyebrow>
              <h2 className="font-display text-3xl sm:text-4xl font-semibold text-(--text-1)">
                From raw CSV to executive decision
              </h2>
              <p className="text-sm sm:text-base text-(--text-2)">
                Three simple steps. No code required.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              
              {/* Step 1 */}
              <div className="space-y-4 relative">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs font-bold text-(--brand) bg-(--brand)/15 px-3 py-1 rounded-md">
                    STEP 01
                  </span>
                  <h3 className="text-xl font-bold text-(--text-1)">Upload &amp; Pick Target</h3>
                </div>
                <p className="text-sm text-(--text-2) leading-relaxed">
                  Upload your tabular CSV or Parquet file and select what you&apos;re trying to explain — churn, cost, conversion, or defects.
                </p>
                <div className="p-4 rounded-xl bg-(--surface-1) border border-(--border-subtle) space-y-2 text-xs">
                  <div className="flex items-center justify-between text-(--text-2)">
                    <span>Target Column:</span>
                    <span className="font-mono text-(--brand)">churn_label</span>
                  </div>
                  <div className="flex items-center justify-between text-(--text-2)">
                    <span>Row Count:</span>
                    <span className="font-mono">7,043 rows</span>
                  </div>
                </div>
              </div>

              {/* Step 2 */}
              <div className="space-y-4 relative">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs font-bold text-(--brand) bg-(--brand)/15 px-3 py-1 rounded-md">
                    STEP 02
                  </span>
                  <h3 className="text-xl font-bold text-(--text-1)">Train &amp; Explain</h3>
                </div>
                <p className="text-sm text-(--text-2) leading-relaxed">
                  The model trains with out-of-fold encoding and computes tree SHAP contributions across every row.
                </p>
                <div className="p-4 rounded-xl bg-(--surface-1) border border-(--border-subtle) space-y-2 text-xs">
                  <div className="flex items-center justify-between text-(--text-2)">
                    <span>Explainer:</span>
                    <span className="font-mono text-(--text-1)">TreeExplainer (XGBoost)</span>
                  </div>
                  <div className="flex items-center justify-between text-(--text-2)">
                    <span>SHAP Cache:</span>
                    <span className="font-mono text-(--success)">Disk Hash Hit</span>
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="space-y-4 relative">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs font-bold text-(--brand) bg-(--brand)/15 px-3 py-1 rounded-md">
                    STEP 03
                  </span>
                  <h3 className="text-xl font-bold text-(--text-1)">Act with Confidence</h3>
                </div>
                <p className="text-sm text-(--text-2) leading-relaxed">
                  Get ranked drivers with explicit confidence tiers, counterfactual what-if simulation, and exportable executive briefs.
                </p>
                <div className="p-4 rounded-xl bg-(--surface-1) border border-(--border-subtle) space-y-2 text-xs">
                  <div className="flex items-center justify-between text-(--text-2)">
                    <span>Reliability Tier:</span>
                    <div className="flex items-center gap-1">
                      <ConfidenceArc cvRatio={0.05} tier="high" size={16} />
                      <span className="font-bold text-(--success)">High</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-(--text-2)">
                    <span>Executive Brief:</span>
                    <span className="font-mono text-(--brand)">Ready (PDF/Print)</span>
                  </div>
                </div>
              </div>

            </div>

          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────────────────────────
           6. TRUST & CONFIDENCE DEEP DIVE (#trust)
           ───────────────────────────────────────────────────────────────────────────── */}
        <section id="trust" className="py-20 sm:py-28 border-b border-(--border-subtle)">
          <div className="max-w-(--page-max-width) mx-auto px-4 sm:px-6">
            <Card padding="xl" tone="strong" className="border border-(--border-default)">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                
                <div className="lg:col-span-7 space-y-4">
                  <div className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-(--brand) uppercase tracking-wider">
                    <ShieldCheck className="h-4 w-4" />
                    <span>Epistemics &amp; Integrity</span>
                  </div>
                  <h2 className="font-display text-2xl sm:text-3xl font-semibold text-(--text-1)">
                    Confidence is earned, not assumed.
                  </h2>
                  <p className="text-sm text-(--text-2) leading-relaxed">
                    Unlike standard dashboards that give you one ungrounded accuracy number, rootLens scores confidence at three independent layers.
                  </p>

                  <div className="space-y-3 pt-2">
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-(--surface-1) border border-(--border-subtle)">
                      <ConfidenceArc cvRatio={0.05} tier="high" size={24} className="mt-0.5" />
                      <div>
                        <h4 className="text-xs font-bold text-(--text-1)">High Confidence (Full Gauge Arc)</h4>
                        <p className="text-xs text-(--text-3) mt-0.5">
                          Low fold variance (<code className="font-mono text-[11px]">cv_std &lt; 0.15</code>), low null ratio, and total sign agreement between SHAP and correlation.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 rounded-lg bg-(--surface-1) border border-(--border-subtle)">
                      <ConfidenceArc cvRatio={0.45} tier="medium" size={24} className="mt-0.5" />
                      <div>
                        <h4 className="text-xs font-bold text-(--text-1)">Medium Confidence (Partial Arc)</h4>
                        <p className="text-xs text-(--text-3) mt-0.5">
                          Moderate fold variance or minor missingness penalty; recommendations are prefixed with &quot;Tentative signal&quot;.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 rounded-lg bg-(--surface-1) border border-(--border-subtle)">
                      <ConfidenceArc cvRatio={0.85} tier="low" size={24} className="mt-0.5" />
                      <div>
                        <h4 className="text-xs font-bold text-(--text-1)">Low Confidence (Minimal Arc)</h4>
                        <p className="text-xs text-(--text-3) mt-0.5">
                          High instability or severe disagreement. Automatically triggers a Critical governance flag.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-5 flex justify-center">
                  <div className="p-6 rounded-2xl bg-(--surface-1) border border-(--border-default) space-y-4 text-center w-full max-w-sm">
                    <div className="h-16 w-16 rounded-2xl bg-(--brand)/15 text-(--brand) flex items-center justify-center mx-auto">
                      <Cpu className="h-8 w-8" />
                    </div>
                    <div>
                      <span className="text-xs font-mono uppercase font-bold text-(--text-3)">Headline Reliability</span>
                      <p className="font-display text-3xl font-bold text-(--text-1) mt-1">ROC-AUC 0.842</p>
                      <span className="text-xs text-(--success) font-semibold">CV std: 0.021 (High Tier)</span>
                    </div>
                    <p className="text-xs text-(--text-2) leading-relaxed">
                      Cross-validation metrics are computed across 5 stratified folds. Outliers or wide variance automatically downgrade the reliability tier.
                    </p>
                  </div>
                </div>

              </div>
            </Card>
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────────────────────────
           7. FAQ ACCORDION (#faq)
           ───────────────────────────────────────────────────────────────────────────── */}
        <section id="faq" className="py-20 sm:py-28 border-b border-(--border-subtle)">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 space-y-8">
            <div className="text-center space-y-2">
              <CardEyebrow>Got Questions?</CardEyebrow>
              <h2 className="font-display text-3xl font-semibold text-(--text-1)">
                Frequently Asked Questions
              </h2>
            </div>

            <div className="space-y-3">
              {faqs.map((faq, idx) => (
                <div
                  key={idx}
                  className="rounded-xl bg-(--surface-1) border border-(--border-subtle) overflow-hidden transition-colors"
                >
                  <button
                    type="button"
                    id={`faq-question-${idx}`}
                    aria-expanded={openFaq === idx}
                    aria-controls={`faq-answer-${idx}`}
                    onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                    className="w-full flex items-center justify-between gap-4 p-5 text-left font-bold text-sm text-(--text-1) hover:text-(--brand)"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown
                      className={`h-4 w-4 text-(--text-3) transition-transform duration-200 shrink-0 ${
                        openFaq === idx ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {openFaq === idx && (
                    <div
                      id={`faq-answer-${idx}`}
                      role="region"
                      aria-labelledby={`faq-question-${idx}`}
                      className="px-5 pb-5 text-xs sm:text-sm text-(--text-2) leading-relaxed border-t border-(--border-subtle) pt-4 animate-fade-in"
                    >
                      {faq.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────────────────────────
           8. CTA BANNER & FOOTER
           ───────────────────────────────────────────────────────────────────────────── */}
        <section className="py-20 bg-(--surface-1)">
          <div className="max-w-4xl mx-auto px-4 text-center space-y-6">
            <h2 className="font-display text-3xl sm:text-4xl font-semibold text-(--text-1)">
              Ready to find out what&apos;s driving your key metric?
            </h2>
            <p className="text-sm sm:text-base text-(--text-2) max-w-xl mx-auto">
              Upload your dataset in seconds and get an executive-grade root-cause report with built-in confidence scoring.
            </p>
            <div className="pt-2">
              <Button to="/upload" size="lg" variant="primary">
                Try it on your data
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-(--border-subtle) py-12 bg-(--app-bg) text-xs text-(--text-3)">
        <div className="max-w-(--page-max-width) mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-(--brand)" />
            <span className="font-display font-semibold text-(--text-1)">rootLens</span>
            <span>— Decision Intelligence Platform</span>
          </div>
          <p>© {new Date().getFullYear()} rootLens. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
