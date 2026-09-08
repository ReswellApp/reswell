import { cn } from '@/lib/utils'

export type AdminStatTone = 'teal' | 'amber' | 'green' | 'red' | 'blue' | 'violet'

const TONE_BAR: Record<AdminStatTone, string> = {
  teal: 'bg-[hsl(var(--admin-teal))]',
  amber: 'bg-amber-400',
  green: 'bg-emerald-500',
  red: 'bg-rose-500',
  blue: 'bg-[hsl(var(--admin-blue))]',
  violet: 'bg-[hsl(var(--admin-purple))]',
}

interface AdminStatCardProps {
  label: string
  value: string
  footnote?: string
  tone?: AdminStatTone
  bare?: boolean
  active?: boolean
  onClick?: () => void
  className?: string
}

export function AdminStatCard({
  label,
  value,
  footnote,
  tone = 'teal',
  bare = false,
  active = false,
  onClick,
  className,
}: AdminStatCardProps) {
  const inner = (
    <>
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-foreground">{value}</p>
      <div className={cn('mt-3 h-0.5 w-10 rounded-full', TONE_BAR[tone])} />
      {footnote ? <p className="mt-2 text-xs text-muted-foreground">{footnote}</p> : null}
    </>
  )

  const sharedClass = cn(
    bare ? 'px-5 py-5 text-left' : 'admin-surface px-5 py-4 text-left',
    onClick && 'transition-colors hover:bg-slate-50 dark:hover:bg-muted/40',
    active && 'bg-slate-50 dark:bg-muted/40',
    className,
  )

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={sharedClass}>
        {inner}
      </button>
    )
  }

  return <div className={sharedClass}>{inner}</div>
}
