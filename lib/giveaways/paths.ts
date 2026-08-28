import { authLandingHref } from "@/lib/auth/auth-landing-href"
import type { GiveawayPrizeBrandId } from "@/lib/types/giveaways"

export const GIVEAWAYS_INDEX_HREF = "/giveaways"

export const WIN_A_SURFBOARD_GIVEAWAY_HREF = GIVEAWAYS_INDEX_HREF

export function giveawaySellHref(brand?: GiveawayPrizeBrandId | null): string {
  const params = new URLSearchParams({
    new: "1",
    from: "giveaway",
  })
  if (brand) params.set("brand", brand)
  return `/sell/boards?${params.toString()}`
}

export function giveawaySignUpHref(brand?: GiveawayPrizeBrandId | null): string {
  return authLandingHref("/auth/sign-up", giveawaySellHref(brand))
}

export function giveawayCtaHref(opts: {
  isLoggedIn: boolean
  brand?: GiveawayPrizeBrandId | null
}): string {
  return opts.isLoggedIn ? giveawaySellHref(opts.brand) : giveawaySignUpHref(opts.brand)
}

/**
 * Already on the surfboard sell form — enter in place instead of navigating away
 * and wiping an in-progress board listing.
 */
export function isGiveawayStayOnSellPath(pathname: string | null): boolean {
  if (!pathname) return false
  return pathname === "/sell/boards" || pathname.startsWith("/sell/boards/")
}
