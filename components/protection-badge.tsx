import Link from 'next/link'
import { ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

type ProtectionBadgeSize = 'sm' | 'md'

interface ProtectionBadgeProps {
  size?: ProtectionBadgeSize
  className?: string
  showLink?: boolean
}

/**
 * Small "Reswell Protected" trust badge — use on listing cards and detail pages.
 */
export function ProtectionBadge({
  size = 'sm',
  className,
  showLink = true,
}: ProtectionBadgeProps) {
  const content = (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 font-medium text-green-700 dark:border-green-800/50 dark:bg-green-950/30 dark:text-green-400',
        size === 'sm' && 'px-2 py-0.5 text-xs',
        size === 'md' && 'px-3 py-1 text-sm',
        className
      )}
    >
      <ShieldCheck
        className={cn(
          'flex-shrink-0',
          size === 'sm' && 'h-3 w-3',
          size === 'md' && 'h-4 w-4'
        )}
        aria-hidden
      />
      Reswell Protected
    </span>
  )

  if (!showLink) return content

  return (
    <Link href="/protection-policy" className="hover:opacity-80 transition-opacity">
      {content}
    </Link>
  )
}
