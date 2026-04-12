import { cn } from "@/lib/utils"

/**
 * Compact UPS-style mark using brand palette (not a downloadable trademark asset).
 * For shipping UI context only.
 */
export function UpsMark({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex h-9 min-w-[3.25rem] shrink-0 items-center justify-center rounded-md bg-[#351C15] px-2 text-[10px] font-bold tracking-[0.12em] text-[#FFB500]",
        className,
      )}
      aria-hidden
    >
      UPS
    </div>
  )
}

/**
 * FedEx-style purple / orange wordmark blocks (brand colors; stylized, not the official vector).
 */
export function FedExMark({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex h-9 shrink-0 overflow-hidden rounded-md text-[10px] font-bold leading-none tracking-tight",
        className,
      )}
      aria-hidden
    >
      <span className="flex items-center bg-[#4D148C] px-2 py-2.5 text-white">Fed</span>
      <span className="flex items-center bg-[#FF6600] px-2 py-2.5 text-white">Ex</span>
    </div>
  )
}
