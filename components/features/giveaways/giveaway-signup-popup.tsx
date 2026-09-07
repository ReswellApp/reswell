"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import type { User } from "@supabase/supabase-js"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import {
  GIVEAWAY_PRIZE_BRAND_LIST_COPY,
  getGiveawayBySlug,
  isGiveawayOpen,
  WIN_A_SURFBOARD_GIVEAWAY_SLUG,
} from "@/lib/giveaways/catalog"
import { writeGiveawayEntryIntent } from "@/lib/giveaways/intent-storage"
import { logGiveawayEvent } from "@/lib/giveaways/log-event"
import { giveawaySellHref } from "@/lib/giveaways/paths"
import {
  dismissGiveawaySignupPopup,
  hasDismissedGiveawaySignupPopup,
} from "@/lib/giveaways/signup-popup-storage"
import { submitGiveawayEntry } from "@/lib/giveaways/submit-entry"
import { navigateAfterClientAuth } from "@/lib/auth/navigate-after-client-auth"
import { setSellEntryPoint } from "@/lib/sell-flow/sell-entry-point"

const RECENT_SIGNUP_MS = 24 * 60 * 60 * 1000

function isRecentSignup(user: User | null | undefined): boolean {
  if (!user?.created_at) return false
  const createdMs = new Date(user.created_at).getTime()
  return Number.isFinite(createdMs) && Date.now() - createdMs < RECENT_SIGNUP_MS
}

function shouldSkipPath(pathname: string | null): boolean {
  if (!pathname) return true
  if (pathname.startsWith("/auth")) return true
  if (pathname === "/sell" || pathname.startsWith("/sell/")) return true
  return false
}

type GiveawaySignupPopupProps = {
  serverUser?: User | null
  /** Welcome pages force the dialog open for every new account. */
  forceOpen?: boolean
}

export function GiveawaySignupPopup({
  serverUser = null,
  forceOpen = false,
}: GiveawaySignupPopupProps) {
  const pathname = usePathname()
  const router = useRouter()
  const giveaway = getGiveawayBySlug(WIN_A_SURFBOARD_GIVEAWAY_SLUG)
  const [open, setOpen] = useState(forceOpen)

  useEffect(() => {
    if (forceOpen) {
      setOpen(true)
      return
    }
    if (!giveaway || !isGiveawayOpen(giveaway)) return
    if (!isRecentSignup(serverUser)) return
    if (shouldSkipPath(pathname)) return
    if (hasDismissedGiveawaySignupPopup()) return
    setOpen(true)
  }, [forceOpen, pathname, serverUser, giveaway])

  const close = useCallback(() => {
    dismissGiveawaySignupPopup()
    setOpen(false)
  }, [])

  const handleList = useCallback(() => {
    writeGiveawayEntryIntent({
      slug: WIN_A_SURFBOARD_GIVEAWAY_SLUG,
      brand: null,
    })
    logGiveawayEvent({
      slug: WIN_A_SURFBOARD_GIVEAWAY_SLUG,
      event: "cta_click",
      surface: "popup",
      preferredBrand: null,
    })
    setSellEntryPoint("giveaway")
    dismissGiveawaySignupPopup()
    void submitGiveawayEntry({
      slug: WIN_A_SURFBOARD_GIVEAWAY_SLUG,
      preferredBrand: null,
    })
    const href = giveawaySellHref(null)
    if (forceOpen) {
      void navigateAfterClientAuth(href, router)
      return
    }
    window.location.assign(href)
  }, [forceOpen, router])

  if (!giveaway || !isGiveawayOpen(giveaway) || !open) return null

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close()
      }}
    >
      <DialogContent
        showCloseButton={false}
        overlayClassName="bg-black/50"
        className="max-w-[400px] gap-0 overflow-hidden border border-black/10 bg-white p-0 shadow-lg sm:rounded-2xl"
      >
        <DialogTitle className="sr-only">List a surfboard to win a surfboard</DialogTitle>
        <div className="relative px-6 pb-6 pt-7 sm:px-7 sm:pb-7 sm:pt-8">
          <button
            type="button"
            onClick={close}
            className="absolute right-4 top-4 rounded-sm p-1 text-black/50 transition hover:text-black"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>

          <p className="text-[11px] font-semibold uppercase tracking-widest text-listingHeart">
            Giveaway
          </p>
          <p className="pr-8 font-headline text-[1.75rem] font-bold leading-tight tracking-[-0.03em] text-black">
            List a surfboard to win a surfboard
          </p>
          <p className="mt-2 text-[14px] leading-relaxed text-black/65">
            Publish a board and you&apos;re entered for a custom from{" "}
            {GIVEAWAY_PRIZE_BRAND_LIST_COPY}. Pick which brand you want after you list.
          </p>

          <Button
            type="button"
            className="mt-5 h-11 w-full rounded-full bg-listingHeart text-[14px] font-medium text-white hover:bg-[#2a4170]"
            onClick={handleList}
          >
            List your surfboard
          </Button>
          <button
            type="button"
            onClick={close}
            className="mt-2 w-full py-1.5 text-center text-[13px] leading-snug text-black/45 underline-offset-2 hover:text-black/70 hover:underline"
          >
            I don&apos;t want to win a custom surfboard
          </button>
          <p className="mt-3 text-center text-[11px] text-black/40">
            <Link href="/giveaways" className="underline-offset-2 hover:underline" onClick={close}>
              See current giveaways
            </Link>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
