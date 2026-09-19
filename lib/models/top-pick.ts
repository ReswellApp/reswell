const CONDITION_SCORE: Record<string, number> = {
  brand_new: 100,
  new: 95,
  like_new: 80,
  excellent: 80,
  very_good: 60,
  good: 40,
  fair: 20,
  poor: 0,
}

const DAY_MS = 24 * 60 * 60 * 1000

export type ModelTopPickInput = {
  id: string
  condition?: string | null
  is_good_deal?: boolean | null
  shipping_available?: boolean | null
  created_at?: string | null
  photo_count?: number
  shop_verified?: boolean | null
}

function recencyBonus(createdAt: string | null | undefined): number {
  if (!createdAt) return 0
  const created = new Date(createdAt).getTime()
  if (!Number.isFinite(created)) return 0
  const days = Math.max(0, (Date.now() - created) / DAY_MS)
  if (days <= 7) return 12
  if (days <= 30) return 8
  if (days <= 90) return 4
  return 0
}

/** Higher is better. Used to choose the featured `/l` listing on a model page. */
export function modelListingTopPickScore(listing: ModelTopPickInput): number {
  const condition = CONDITION_SCORE[(listing.condition ?? "").trim()] ?? 30
  const deal = listing.is_good_deal ? 15 : 0
  const shipping = listing.shipping_available ? 10 : 0
  const verified = listing.shop_verified ? 10 : 0
  const photos = Math.min(Math.max(listing.photo_count ?? 0, 0), 6) * 2
  return condition + deal + shipping + verified + photos + recencyBonus(listing.created_at)
}

export function pickTopModelListing<T extends ModelTopPickInput>(listings: readonly T[]): T | null {
  if (listings.length === 0) return null
  return [...listings].sort((a, b) => {
    const scoreDelta = modelListingTopPickScore(b) - modelListingTopPickScore(a)
    if (scoreDelta !== 0) return scoreDelta
    return (b.created_at ?? "").localeCompare(a.created_at ?? "")
  })[0] ?? null
}
