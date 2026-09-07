"use client"

import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { GIVEAWAY_PRIZE_BRAND_LIST_COPY } from "@/lib/giveaways/catalog"
import type { Giveaway, GiveawayPrizeBrandId } from "@/lib/types/giveaways"

type SignUpGiveawayScreenProps = {
  giveaway: Giveaway
  firstName?: string | null
  initialBrand?: GiveawayPrizeBrandId | null
  /** @deprecated Brand is chosen after listing. */
  hideBrandPicker?: boolean
  /** @deprecated Brand is chosen after listing. */
  onBrandChange?: (brand: GiveawayPrizeBrandId) => void
  onList: (brand: GiveawayPrizeBrandId | null) => void
  onDecline: () => void
}

export function SignUpGiveawayScreen({
  giveaway,
  firstName,
  onList,
  onDecline,
}: SignUpGiveawayScreenProps) {
  const greeting = firstName ? `Welcome, ${firstName}` : "You're in"

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-md">
        <Card className="relative">
          <button
            type="button"
            onClick={onDecline}
            className="absolute right-4 top-4 rounded-sm p-1 text-muted-foreground transition hover:text-foreground"
            aria-label="Exit"
          >
            <X className="h-4 w-4" />
          </button>
          <CardHeader className="text-center">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-listingHeart">
              {giveaway.eyebrow}
            </p>
            <CardTitle className="text-2xl leading-tight">
              List a surfboard to win a surfboard
            </CardTitle>
            <CardDescription className="text-base">
              {greeting}. Publish a board and you&apos;re entered for a custom from{" "}
              {GIVEAWAY_PRIZE_BRAND_LIST_COPY}. You&apos;ll pick the brand after you list.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2.5">
            <Button
              type="button"
              className="h-12 w-full rounded-full bg-listingHeart text-white hover:bg-[#2a4170]"
              onClick={() => onList(null)}
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
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
