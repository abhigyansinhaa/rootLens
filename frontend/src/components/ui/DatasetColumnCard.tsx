import { HelpTooltip } from './HelpTooltip'
import { StatusBadge } from './StatusBadge'
import { formatNumber, formatPct01 } from '../kpi/format'
import type { ColumnSchema } from '../../types'

export function DatasetColumnCard({ col }: { col: ColumnSchema }) {
  const isTarget = col.name.toLowerCase().includes('target') || 
                   col.name.toLowerCase().includes('churn') ||
                   col.name.toLowerCase().includes('label')
                   
  const isId = col.name.toLowerCase().endsWith('_id') || col.name.toLowerCase() === 'id'
  
  // Health heuristics
  const nullPct = col.null_ratio
  const nullTone = nullPct > 0.5 ? 'risk' : nullPct > 0.1 ? 'warning' : 'success'
  
  const dtypeColor = col.dtype.includes('float') || col.dtype.includes('int') 
    ? 'text-cyan-500' 
    : col.dtype.includes('bool') 
      ? 'text-purple-500'
      : col.dtype.includes('datetime')
        ? 'text-emerald-500'
        : 'text-amber-500' // object/string

  return (
    <div className="flex flex-col justify-between rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-4 transition-colors hover:border-[var(--border-default)] hover:bg-[var(--surface-2)]">
      <div>
        <div className="flex items-start justify-between gap-2 mb-3">
          <p className="font-mono text-sm font-bold text-[var(--text-1)] break-all" title={col.name}>
            {col.name}
          </p>
          <div className="flex shrink-0 items-center gap-1.5">
            {isTarget && <StatusBadge tone="info" className="text-[9px]">Target?</StatusBadge>}
            {isId && <StatusBadge tone="default" className="text-[9px]">ID</StatusBadge>}
            <span className={`text-[10px] font-mono font-bold uppercase ${dtypeColor}`}>
              {col.dtype}
            </span>
          </div>
        </div>

        {/* Null ratio bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.1em] font-bold mb-1.5">
            <span className="text-[var(--text-3)] flex items-center gap-1">
              Missing
              {nullPct > 0.5 && <HelpTooltip title="Columns with >50% missing values are often dropped.">!</HelpTooltip>}
            </span>
            <span className={nullPct > 0 ? 'text-[var(--text-2)]' : 'text-[var(--c-success)]'}>
              {formatPct01(nullPct)}
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-[var(--surface-3)] overflow-hidden">
            <div 
              className={`h-full rounded-full ${
                nullTone === 'risk' ? 'bg-[var(--c-danger)]' : 
                nullTone === 'warning' ? 'bg-[var(--c-warning)]' : 
                'bg-[var(--c-success)]'
              }`}
              style={{ width: `${Math.max(1, nullPct * 100)}%` }}
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-[var(--text-3)] border-t border-[var(--border-subtle)] pt-3">
        <span><span className="font-semibold text-[var(--text-2)]">{formatNumber(col.n_unique)}</span> unique</span>
        <span className="truncate max-w-[120px] ml-4 text-right" title={col.sample_values?.join(', ')}>
          {col.sample_values?.slice(0, 2).join(', ')}...
        </span>
      </div>
    </div>
  )
}
