"use client"

import { Ban } from "lucide-react"
import { MessagesSupportDialog } from "@/components/features/messages/messages-support-dialog"
import { SELLER_BANNED_USER_MESSAGE } from "@/lib/messages/seller-ban-errors"
import { cn } from "@/lib/utils"

type SellerBanRestrictedPanelProps = {
  className?: string
  compact?: boolean
}

export function SellerBanRestrictedPanel({
  className,
  compact = false,
}: SellerBanRestrictedPanelProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-orange-500/30 bg-orange-500/10 px-4 py-4 text-orange-950 dark:text-orange-100",
        compact ? "space-y-3" : "space-y-4 sm:px-6 sm:py-5",
        className,
      )}
      role="status"
    >
      <div className="flex items-start gap-3">
        <Ban className="mt-0.5 h-5 w-5 shrink-0 text-orange-700 dark:text-orange-300" aria-hidden />
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold tracking-tight">
            Your account has been temporarily restricted
          </p>
          <p className="text-sm text-orange-900/80 dark:text-orange-100/80">
            {SELLER_BANNED_USER_MESSAGE}
          </p>
        </div>
      </div>
      <div className={cn(compact ? "" : "pl-8")}>
        <MessagesSupportDialog
          triggerLabel="Get help"
          variant="outline"
          size="sm"
          triggerClassName="border-orange-600/40 bg-background/60 text-orange-950 hover:bg-background dark:text-orange-50"
        />
      </div>
    </div>
  )
}
