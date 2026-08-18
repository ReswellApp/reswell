import { authLandingHref } from "@/lib/auth/auth-landing-href"
import { WIN_A_SURFBOARD_GIVEAWAY_SLUG } from "@/lib/giveaways/catalog"
import type { GiveawayPrizeBrandId } from "@/lib/types/giveaways"

export const GIVEAWAYS_INDEX_HREF = "/giveaways"

export function giveawayDetailHref(
  slug: string,
  opts?: { brand?: GiveawayPrizeBrandId | null; hash?: string },
): string {
  const params = new URLSearchParams()
  if (opts?.brand) params.set("brand", opts.brand)
  const query = params.toString()
  const hash = opts?.hash ? `#${opts.hash}` : ""
  return `/giveaways/${slug}${query ? `?${query}` : ""}${hash}`
}

export const WIN_A_SURFBOARD_GIVEAWAY_HREF = giveawayDetailHref(
  WIN_A_SURFBOARD_GIVEAWAY_SLUG,
)

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
