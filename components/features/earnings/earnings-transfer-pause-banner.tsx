import { Info } from "lucide-react"
import { EARNINGS_TRANSFER_PAUSE } from "@/lib/earnings-transfer-pause"

export function EarningsTransferPauseBanner() {
  return (
    <div
      role="status"
      className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100"
    >
      <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0 space-y-1">
        <p className="text-sm font-semibold leading-snug">{EARNINGS_TRANSFER_PAUSE.bannerTitle}</p>
        <p className="text-sm leading-relaxed">{EARNINGS_TRANSFER_PAUSE.bannerBody}</p>
      </div>
    </div>
  )
}
