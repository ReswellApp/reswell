import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export function BoardFinderChip({
  selected,
  onSelect,
  children,
}: {
  selected: boolean
  onSelect: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        selected
          ? "border-[#001A4A] bg-[#001A4A] text-white"
          : "border-border bg-white text-[#001A4A] hover:border-[#5574AD]/50 hover:bg-[#F4F7FB]",
      )}
    >
      {children}
    </button>
  )
}
