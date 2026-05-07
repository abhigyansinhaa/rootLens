import type { ReactNode, ThHTMLAttributes, TdHTMLAttributes, HTMLAttributes } from 'react'

export function DataTable({ children, className = '', ...rest }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--border-1)] bg-[var(--surface-1)]">
      <table className={`min-w-full text-left text-sm ${className}`.trim()} {...rest}>
        {children}
      </table>
    </div>
  )
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead className="border-b border-[var(--border-1)] bg-[var(--surface-3)] text-[10px] font-black uppercase tracking-[0.18em] text-[var(--text-3)]">
      {children}
    </thead>
  )
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-[var(--border-1)]">{children}</tbody>
}

export function TR({ children, className = '', ...rest }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className={`transition-colors hover:bg-[var(--surface-3)]/60 ${className}`.trim()} {...rest}>
      {children}
    </tr>
  )
}

type ThProps = ThHTMLAttributes<HTMLTableCellElement> & {
  align?: 'left' | 'right' | 'center'
}

export function TH({ children, className = '', align = 'left', ...rest }: ThProps) {
  const alignCls = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
  return (
    <th
      scope="col"
      className={`px-4 py-3 font-bold ${alignCls} ${className}`.trim()}
      {...rest}
    >
      {children}
    </th>
  )
}

type TdProps = TdHTMLAttributes<HTMLTableCellElement> & {
  align?: 'left' | 'right' | 'center'
  numeric?: boolean
  mono?: boolean
}

export function TD({
  children,
  className = '',
  align = 'left',
  numeric = false,
  mono = false,
  ...rest
}: TdProps) {
  const alignCls = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
  const numericCls = numeric ? 'tabular-nums' : ''
  const monoCls = mono ? 'font-mono text-xs' : ''
  return (
    <td
      className={`px-4 py-3 text-[var(--text-1)] ${alignCls} ${numericCls} ${monoCls} ${className}`.trim()}
      {...rest}
    >
      {children}
    </td>
  )
}
