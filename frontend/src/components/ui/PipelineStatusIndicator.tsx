import { CheckCircle2, Circle, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'

const STAGES = [
  { id: 'profiling', label: 'Profiling Schema' },
  { id: 'training', label: 'Training Models' },
  { id: 'calibration', label: 'Calibrating Thresholds' },
  { id: 'explaining', label: 'Computing SHAP' },
  { id: 'decisioning', label: 'Generating Copilot Insights' },
]

export function PipelineStatusIndicator({ status }: { status: string }) {
  // If the backend isn't updating fast enough, we simulate progress visually.
  // Ideally, 'status' maps directly to one of the stages.
  const [activeStageIdx, setActiveStageIdx] = useState(0)

  useEffect(() => {
    const idx = STAGES.findIndex((s) => s.id === status)
    if (idx >= 0 && idx !== activeStageIdx) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveStageIdx(idx)
    } else if (status === 'queued' || status === 'running') {
      // Simulate progress if just generic "running"
      const interval = setInterval(() => {
        setActiveStageIdx((prev) => (prev < STAGES.length - 1 ? prev + 1 : prev))
      }, 5000)
      return () => clearInterval(interval)
    }
  }, [status, activeStageIdx])

  return (
    <div className="w-full max-w-2xl mx-auto py-12 px-6">
      <div className="text-center mb-10 animate-fade-in-up">
        <h2 className="text-xl font-bold tracking-tight text-(--text-1) mb-2">Analyzing Data</h2>
        <p className="text-sm text-(--text-2)">Serious AI work is happening. Please do not close this window.</p>
      </div>

      <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-(--surface-3) before:via-(--surface-3) before:to-transparent">
        {STAGES.map((stage, idx) => {
          const isCompleted = idx < activeStageIdx
          const isActive = idx === activeStageIdx
          const isPending = idx > activeStageIdx

          return (
            <div key={stage.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group animate-fade-in-up" style={{ animationDelay: `${idx * 100}ms` }}>
              <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-(--app-bg) bg-(--surface-1) shadow-sm shrink-0 md:order-1 md:group-odd:-ml-5 md:group-even:-mr-5 z-10 transition-colors duration-500" style={{
                backgroundColor: isCompleted ? 'var(--c-success-bg)' : isActive ? 'var(--brand-dim)' : 'var(--surface-2)',
                borderColor: 'var(--app-bg)'
              }}>
                {isCompleted ? (
                  <CheckCircle2 className="h-5 w-5 text-(--c-success)" />
                ) : isActive ? (
                  <Loader2 className="h-5 w-5 text-(--brand) animate-spin" />
                ) : (
                  <Circle className="h-3 w-3 text-(--surface-4)" fill="currentColor" />
                )}
              </div>

              <div className={`w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] border border-(--border-subtle) rounded-lg p-4 shadow-sm transition-all duration-500 ${isActive ? 'bg-(--surface-1) border-(--border-brand) shadow-(--shadow-sm)' : 'bg-(--surface-2)/50'}`}>
                <div className="flex items-center justify-between mb-1">
                  <h3 className={`text-sm font-bold ${isActive ? 'text-(--text-1)' : isCompleted ? 'text-(--text-2)' : 'text-(--text-3)'}`}>
                    {stage.label}
                  </h3>
                  {isActive && <span className="text-[10px] upperootLensse tracking-wider font-semibold text-(--brand) animate-pulse">In Progress</span>}
                  {isCompleted && <span className="text-[10px] upperootLensse tracking-wider font-semibold text-(--c-success)">Done</span>}
                  {isPending && <span className="text-[10px] upperootLensse tracking-wider font-semibold text-(--text-4)">Pending</span>}
                </div>
                {isActive && (
                  <div className="w-full bg-(--surface-3) rounded-full h-1.5 mt-3 overflow-hidden">
                    <div className="bg-(--brand) h-1.5 rounded-full w-full animate-progress" style={{ animationDuration: '5s' }} />
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
