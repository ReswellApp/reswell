import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

function formatNavUnreadCount(count: number): string {
  return count > 9 ? '9+' : String(count)
}

interface NavUnreadCountBadgeProps {
  count: number
  className?: string
  /** Positions on a header icon button (messages, notifications). */
  overlay?: boolean
}

/** Red count pill — same styling as site header Messages. */
export function NavUnreadCountBadge({
  count,
  className,
  overlay = false,
}: NavUnreadCountBadgeProps) {
  if (count <= 0) return null

  return (
    <Badge
      variant="destructive"
      className={cn(
        'flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1 text-xs text-white hover:bg-red-600',
        overlay && 'pointer-events-none absolute -right-1 -top-1',
        className,
      )}
    >
      {formatNavUnreadCount(count)}
    </Badge>
  )
}
