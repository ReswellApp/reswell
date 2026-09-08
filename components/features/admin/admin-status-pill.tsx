import { cn } from '@/lib/utils'
import {
  resolveAdminOrderDisplayStatus,
  type AdminOrderDisplayTone,
  type AdminOrderFulfillmentInput,
} from '@/lib/admin/admin-order-fulfillment-status'

type StatusTone = AdminOrderDisplayTone

const TONE_CLASS: Record<StatusTone, string> = {
  green: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
  amber: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  blue: 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400',
  red: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400',
  violet: 'bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-400',
  slate: 'bg-slate-100 text-slate-600 dark:bg-slate-500/10 dark:text-slate-300',
}

const DOT_CLASS: Record<StatusTone, string> = {
  green: 'bg-emerald-500',
  amber: 'bg-amber-500',
  blue: 'bg-sky-500',
  red: 'bg-rose-500',
  violet: 'bg-violet-500',
  slate: 'bg-slate-400',
}

function toneForOrderStatus(status: string): StatusTone {
  switch (status) {
    case 'confirmed':
      return 'green'
    case 'pending':
      return 'amber'
    case 'refunding':
      return 'blue'
    case 'refunded':
      return 'red'
    default:
      return 'slate'
  }
}

function labelForOrderStatus(status: string): string {
  switch (status) {
    case 'confirmed':
      return 'Confirmed'
    case 'pending':
      return 'Pending'
    case 'refunding':
      return 'Refunding'
    case 'refunded':
      return 'Refunded'
    default:
      return status
  }
}

interface AdminStatusPillProps {
  status?: string
  label?: string
  tone?: StatusTone
  fulfillment?: AdminOrderFulfillmentInput
  className?: string
}

export function AdminStatusPill({
  status,
  label,
  tone,
  fulfillment,
  className,
}: AdminStatusPillProps) {
  const fromFulfillment = fulfillment ? resolveAdminOrderDisplayStatus(fulfillment) : null
  const resolvedTone = tone ?? fromFulfillment?.tone ?? (status ? toneForOrderStatus(status) : 'slate')
  const resolvedLabel =
    label ?? fromFulfillment?.label ?? (status ? labelForOrderStatus(status) : '—')

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
        TONE_CLASS[resolvedTone],
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', DOT_CLASS[resolvedTone])} aria-hidden />
      {resolvedLabel}
    </span>
  )
}
