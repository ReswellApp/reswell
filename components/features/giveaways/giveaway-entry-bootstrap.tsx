"use client"

import { useEffect, useRef } from "react"
import { WIN_A_SURFBOARD_GIVEAWAY_SLUG } from "@/lib/giveaways/catalog"
import {
  clearGiveawayEntryIntent,
  parseGiveawayBrandParam,
  readGiveawayEntryIntent,
} from "@/lib/giveaways/intent-storage"
import { dismissGiveawaySignupPopup } from "@/lib/giveaways/signup-popup-storage"
import { submitGiveawayEntry } from "@/lib/giveaways/submit-entry"

/** Persists raffle intent after sign-up or brand pick once the user has a session. */
export function GiveawayEntryBootstrap({ isLoggedIn }: { isLoggedIn: boolean }) {
  const ranRef = useRef(false)

  useEffect(() => {
    if (!isLoggedIn || ranRef.current) return
    ranRef.current = true

    const params = new URLSearchParams(window.location.search)
    const fromGiveaway = params.get("from") === "giveaway"
    const urlBrand = parseGiveawayBrandParam(params.get("brand"))
    const stored = readGiveawayEntryIntent()
    if (!fromGiveaway && !stored) return

    if (fromGiveaway) dismissGiveawaySignupPopup()

    void submitGiveawayEntry({
      slug: stored?.slug ?? WIN_A_SURFBOARD_GIVEAWAY_SLUG,
      preferredBrand: urlBrand ?? stored?.brand ?? null,
      signedUpFromCta: stored?.fromCta === true,
    }).then((result) => {
      if (result.ok) {
        clearGiveawayEntryIntent()
        dismissGiveawaySignupPopup()
      }
    })
  }, [isLoggedIn])

  return null
}
