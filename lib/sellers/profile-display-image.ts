import {
  listingCardImageSrc,
  type ListingImageForCard,
} from "@/lib/listing-image-display"
import { profileMediaDisplaySrc } from "@/lib/public-media-display-src"

export type SellerProfileImagePick = {
  is_shop?: boolean | null
  shop_logo_url?: string | null
  avatar_url?: string | null
}

export type ListingImageSourcePick = {
  listing_images?: ListingImageForCard[] | null
}

function trimUrl(raw: string | null | undefined): string | null {
  const t = typeof raw === "string" ? raw.trim() : ""
  return t.length > 0 ? t : null
}

/**
 * Public seller avatar: shop logo (shop accounts only), then profile photo,
 * then the first usable image from the seller's listings (active or sold).
 */
export function resolveSellerProfileDisplayImageUrl(
  profile: SellerProfileImagePick,
  listingSources?: ListingImageSourcePick[] | null,
): string {
  if (profile.is_shop) {
    const logo = trimUrl(profile.shop_logo_url)
    if (logo) return profileMediaDisplaySrc(logo)
  }

  const avatar = trimUrl(profile.avatar_url)
  if (avatar) return profileMediaDisplaySrc(avatar)

  for (const listing of listingSources ?? []) {
    const src = listingCardImageSrc(listing.listing_images)
    if (src) return src
  }

  return ""
}
