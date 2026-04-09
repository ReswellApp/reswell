import Link from 'next/link'
import { ShieldCheck, Package, Tag, AlertTriangle } from 'lucide-react'

/**
 * Checkout trust block — shown next to order summary when shipping is selected.
 */
export function ProtectionTrustBlock() {
  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 dark:border-blue-800/40 dark:bg-blue-950/20">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <ShieldCheck className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0" aria-hidden />
        <span className="font-semibold text-blue-900 dark:text-blue-300 text-sm">
          Reswell Purchase Protection
        </span>
      </div>

      <p className="text-xs text-blue-800/80 dark:text-blue-400/80 mb-3">
        Every order on Reswell is protected:
      </p>

      {/* Coverage rows */}
      <div className="space-y-2">
        <div className="flex items-start gap-2.5">
          <Package className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" aria-hidden />
          <div className="min-w-0">
            <span className="text-xs font-medium text-blue-900 dark:text-blue-300">
              Item never arrives
            </span>
            <span className="text-xs text-blue-700 dark:text-blue-500">
              {' '}→{' '}
            </span>
            <span className="text-xs font-semibold text-blue-900 dark:text-blue-300">
              every dollar back, no return needed
            </span>
          </div>
        </div>

        <div className="flex items-start gap-2.5">
          <Tag className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" aria-hidden />
          <div className="min-w-0">
            <span className="text-xs font-medium text-blue-900 dark:text-blue-300">
              Item not as described
            </span>
            <span className="text-xs text-blue-700 dark:text-blue-500">
              {' '}→{' '}
            </span>
            <span className="text-xs font-semibold text-blue-900 dark:text-blue-300">
              every dollar back, return required
            </span>
          </div>
        </div>

        <div className="flex items-start gap-2.5">
          <AlertTriangle className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" aria-hidden />
          <div className="min-w-0">
            <span className="text-xs font-medium text-blue-900 dark:text-blue-300">
              Item arrives damaged
            </span>
            <span className="text-xs text-blue-700 dark:text-blue-500">
              {' '}→{' '}
            </span>
            <span className="text-xs font-semibold text-blue-900 dark:text-blue-300">
              every dollar back, return required
            </span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-800/40 flex items-center justify-between">
        <p className="text-xs text-blue-700/70 dark:text-blue-500/70">
          Protection active for 30 days after delivery.
        </p>
        <Link
          href="/protection-policy"
          className="text-xs font-medium text-blue-700 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 underline underline-offset-2 transition-colors"
        >
          Learn more
        </Link>
      </div>
    </div>
  )
}
