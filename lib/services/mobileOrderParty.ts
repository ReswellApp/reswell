import { mobileOrderPartySchema, type MobileOrderParty } from "@reswell/api-contract"
import { getSellerReviewSummary } from "@/lib/db/seller-reviews"
import { absoluteProfileCircleUrl } from "@/lib/profile-circle"
import type { SupabaseClient } from "@supabase/supabase-js"

export const MOBILE_ORDER_PARTY_SELECT =
  "id, display_name, seller_slug, avatar_url, is_shop, shop_name, shop_logo_url, shop_verified"

export type MobileOrderPartyProfileRow = {
  id?: string | null
  display_name?: string | null
  seller_slug?: string | null
  avatar_url?: string | null
  is_shop?: boolean | null
  shop_name?: string | null
  shop_logo_url?: string | null
  shop_verified?: boolean | null
}

function text(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export function partyDisplayName(
  profile: MobileOrderPartyProfileRow | null | undefined,
  fallbackName?: string | null,
): string {
  if (profile?.is_shop) {
    const shop = text(profile.shop_name)
    if (shop) return shop
  }
  return text(profile?.display_name) ?? text(fallbackName) ?? "Anonymous"
}

export function toMobileOrderParty(
  profile: MobileOrderPartyProfileRow | null | undefined,
  extras: {
    userId: string
    fallbackName?: string | null
    following?: boolean
    ratingAverage?: number
    reviewCount?: number
  },
): MobileOrderParty | null {
  const id = text(profile?.id) ?? text(extras.userId)
  if (!id) return null
  const avatar = profile?.is_shop
    ? text(profile.shop_logo_url) ?? text(profile.avatar_url)
    : text(profile?.avatar_url)
  const rating = extras.ratingAverage ?? 0
  const reviews = extras.reviewCount ?? 0
  const party = {
    id,
    name: partyDisplayName(profile, extras.fallbackName),
    seller_slug: text(profile?.seller_slug),
    avatar_url: avatar ? absoluteProfileCircleUrl(avatar) : null,
    verified: Boolean(profile?.is_shop && profile.shop_verified),
    ...(extras.following === undefined ? {} : { following: extras.following }),
    rating_average: Number.isFinite(rating) ? Math.min(5, Math.max(0, rating)) : 0,
    review_count: Number.isFinite(reviews) && reviews > 0 ? Math.floor(reviews) : 0,
  }
  const parsed = mobileOrderPartySchema.safeParse(party)
  return parsed.success ? parsed.data : null
}

async function followingPartyId(
  supabase: SupabaseClient,
  viewerId: string,
  partyId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("seller_follows")
    .select("seller_id")
    .eq("follower_id", viewerId)
    .eq("seller_id", partyId)
    .maybeSingle()
  if (error) {
    console.error("[mobile-order-party] following lookup failed", {
      timestamp: new Date().toISOString(),
      message: error.message,
    })
    return false
  }
  return Boolean(data)
}

export async function loadMobileOrderParty(
  supabase: SupabaseClient,
  userId: string | null | undefined,
  extras: { viewerId: string; fallbackName?: string | null },
): Promise<MobileOrderParty | null> {
  const id = text(userId)
  if (!id) return null

  const [profileResult, reviews, following] = await Promise.all([
    supabase.from("profiles").select(MOBILE_ORDER_PARTY_SELECT).eq("id", id).maybeSingle(),
    getSellerReviewSummary(supabase, id),
    followingPartyId(supabase, extras.viewerId, id),
  ])

  if (profileResult.error) {
    console.error("[mobile-order-party] profile lookup failed", {
      timestamp: new Date().toISOString(),
      userId: id,
      message: profileResult.error.message,
    })
  }

  return toMobileOrderParty(profileResult.data as MobileOrderPartyProfileRow | null, {
    userId: id,
    fallbackName: extras.fallbackName,
    following,
    ratingAverage: reviews.data.avgRating,
    reviewCount: reviews.data.reviewCount,
  })
}
