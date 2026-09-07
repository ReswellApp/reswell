import { SELL_PAGE_GROUND_CLASS } from "@/components/features/sell/sell-form-surface"
import { cn } from "@/lib/utils"

/** Compact “Start your listing” bar — brand off-white strip (matches sell form ground). */
export function SellHubTitleBar() {
  return (
    <div className={cn("border-b border-border/60", SELL_PAGE_GROUND_CLASS)}>
      <div className="mx-auto w-full max-w-3xl px-4 py-4 text-center sm:px-6 sm:py-5 sm:text-left">
        <h1 className="font-headline text-2xl font-bold tracking-tight text-[#001A4A] sm:text-3xl">
          Start your listing
        </h1>
      </div>
    </div>
  )
}
