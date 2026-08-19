"use client"

import { useState } from "react"
import { GiveawayBrandPicker } from "@/components/features/giveaways/giveaway-brand-picker"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  GIVEAWAY_PRIZE_BRAND_LIST_COPY,
  getGiveawayPrizeBrand,
  giveawayPrizeBrandsFor,
} from "@/lib/giveaways/catalog"
import type { Giveaway, GiveawayPrizeBrandId } from "@/lib/types/giveaways"

type SignUpGiveawayScreenProps = {
  giveaway: Giveaway
  firstName?: string | null
  initialBrand?: GiveawayPrizeBrandId | null
  /** Hide the picker when they already chose a brand on /giveaways. */
  hideBrandPicker?: boolean
  onBrandChange?: (brand: GiveawayPrizeBrandId) => void
  onList: (brand: GiveawayPrizeBrandId | null) => void
  onDecline: () => void
}

export function SignUpGiveawayScreen({
  giveaway,
  firstName,
  initialBrand = null,
  hideBrandPicker = false,
  onBrandChange,
  onList,
  onDecline,
}: SignUpGiveawayScreenProps) {
  const [brand, setBrand] = useState<GiveawayPrizeBrandId | null>(initialBrand)
  const brands = giveawayPrizeBrandsFor(giveaway)
  const greeting = firstName ? `Welcome, ${firstName}` : "You're in"
  const savedBrandName = brand ? getGiveawayPrizeBrand(brand)?.name : null

  const handleBrand = (next: GiveawayPrizeBrandId) => {
    setBrand(next)
    onBrandChange?.(next)
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader className="text-center">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-listingHeart">
              {giveaway.eyebrow}
            </p>
            <CardTitle className="text-2xl leading-tight">
              List a surfboard to win a surfboard
            </CardTitle>
            <CardDescription className="text-base">
              {greeting}. Publish a board and you&apos;re entered for a custom
              {savedBrandName ? ` ${savedBrandName}.` : ` from ${GIVEAWAY_PRIZE_BRAND_LIST_COPY}.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            {hideBrandPicker ? null : (
              <div>
                <p className="mb-2.5 text-left text-sm font-medium text-foreground">
                  Which custom do you want to win?
                </p>
                <GiveawayBrandPicker brands={brands} value={brand} onChange={handleBrand} />
              </div>
            )}
            <div className="flex flex-col gap-2.5">
              <Button
                type="button"
                className="h-12 w-full rounded-full bg-listingHeart text-white hover:bg-[#2a4170]"
                onClick={() => onList(brand)}
              >
                List your surfboard
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-auto w-full whitespace-normal rounded-full px-4 py-3 text-sm leading-snug"
                onClick={onDecline}
              >
                I don&apos;t want to win a custom surfboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
