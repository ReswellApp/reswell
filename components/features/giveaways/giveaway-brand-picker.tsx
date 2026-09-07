"use client"

import { Check } from "lucide-react"
import type { GiveawayPrizeBrand, GiveawayPrizeBrandId } from "@/lib/types/giveaways"
import { cn } from "@/lib/utils"

type GiveawayBrandPickerProps = {
  brands: readonly GiveawayPrizeBrand[]
  value: GiveawayPrizeBrandId | null
  onChange: (brand: GiveawayPrizeBrandId) => void
  tone?: "light" | "dark"
  className?: string
}

export function GiveawayBrandPicker({
  brands,
  value,
  onChange,
  tone = "light",
  className,
}: GiveawayBrandPickerProps) {
  const dark = tone === "dark"

  return (
    <div
      role="radiogroup"
      aria-label="Choose the brand you want to win"
      className={cn("grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3", className)}
    >
      {brands.map((brand) => {
        const selected = value === brand.id
        return (
          <button
            key={brand.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(brand.id)}
            className={cn(
              "relative rounded-2xl border px-3 py-3 text-left transition-colors sm:px-4 sm:py-3.5",
              dark
                ? selected
                  ? "border-white bg-white text-[#001A4A]"
                  : "border-white/25 bg-white/5 text-white hover:border-white/50 hover:bg-white/10"
                : selected
                  ? "border-listingHeart bg-listingHeart text-white"
                  : "border-foreground/15 bg-white text-foreground hover:border-foreground/30 hover:bg-neutral-50",
            )}
          >
            {selected ? (
              <Check
                className={cn(
                  "absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2",
                  dark ? "text-[#001A4A]" : "text-white",
                )}
                aria-hidden
              />
            ) : null}
            <p className="pr-5 text-sm font-semibold leading-tight">{brand.name}</p>
          </button>
        )
      })}
    </div>
  )
}
