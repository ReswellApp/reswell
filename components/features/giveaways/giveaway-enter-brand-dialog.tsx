"use client"

import { X } from "lucide-react"
import { GiveawayBrandPicker } from "@/components/features/giveaways/giveaway-brand-picker"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import type { GiveawayPrizeBrand, GiveawayPrizeBrandId } from "@/lib/types/giveaways"

type GiveawayEnterBrandDialogProps = {
  open: boolean
  brands: readonly GiveawayPrizeBrand[]
  value: GiveawayPrizeBrandId | null
  isLoggedIn: boolean
  onOpenChange: (open: boolean) => void
  onBrandChange: (brand: GiveawayPrizeBrandId) => void
  onContinue: (brand: GiveawayPrizeBrandId) => void
}

export function GiveawayEnterBrandDialog({
  open,
  brands,
  value,
  isLoggedIn,
  onOpenChange,
  onBrandChange,
  onContinue,
}: GiveawayEnterBrandDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        overlayClassName="bg-black/50"
        className="max-w-[400px] gap-0 overflow-hidden border border-black/10 bg-white p-0 shadow-lg sm:rounded-2xl"
      >
        <DialogTitle className="sr-only">Pick a brand to enter</DialogTitle>
        <div className="relative px-6 pb-6 pt-7 sm:px-7 sm:pb-7 sm:pt-8">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="absolute right-4 top-4 rounded-sm p-1 text-black/50 transition hover:text-black"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>

          <p className="text-[11px] font-semibold uppercase tracking-widest text-listingHeart">
            Giveaway
          </p>
          <p className="pr-8 font-headline text-[1.75rem] font-bold leading-tight tracking-[-0.03em] text-black">
            Pick a brand
          </p>
          <p className="mt-2 text-[14px] leading-relaxed text-black/65">
            {isLoggedIn
              ? "Choose the custom you want. Then list a surfboard."
              : "Choose the custom you want. Then sign up and list a surfboard."}
          </p>

          <div className="mt-5">
            <GiveawayBrandPicker brands={brands} value={value} onChange={onBrandChange} />
          </div>

          <Button
            type="button"
            className="mt-5 h-11 w-full rounded-full bg-listingHeart text-[14px] font-medium text-white hover:bg-[#2a4170]"
            disabled={!value}
            onClick={() => {
              if (!value) return
              onContinue(value)
            }}
          >
            {isLoggedIn ? "List a surfboard" : "Sign up & list a surfboard to enter"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
