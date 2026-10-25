import {
  mobileHomeBrandSchema,
  mobileHomeShopSchema,
  type MobileHomeBrand,
  type MobileHomeSection,
  type MobileHomeShop,
  type MobileListingCard,
} from "@reswell/api-contract"
import type { HomeFeedSection } from "@/lib/services/homeFeedPlan"
import { brandLogoDisplaySrc } from "@/lib/brand-media-proxy-url"
import type { MobileListingRow } from "@/lib/db/mobile-listings"
import { toMobileListingCard } from "@/lib/services/mobileApi"
import { absoluteProfileCircleUrl } from "@/lib/profile-circle"
import { absolutePublicMediaUrl } from "@/lib/site-metadata"

/** Homepage peer card after the site has already chosen and ordered it. */
export type HomePeerCardSource = {
  id: string
  slug: string | null
  title: string
  price: string | number
  status: string
  section: string
  condition?: string | null
  board_type?: string | null
  local_pickup?: boolean | null
  shipping_available?: boolean | null
  hidden_from_site?: boolean | null
  archived_at?: string | null
  listing_images?: MobileListingRow["listing_images"]
}

export type HomeShopSource = {
  id: string
  seller_slug: string | null
  display_name: string | null
  avatar_url: string | null
  city: string | null
  location: string | null
  is_shop: boolean | null
  shop_name: string | null
  shop_logo_url: string | null
  shop_verified: boolean | null
  shop_address: string | null
}

export type HomeShopProductSource = {
  id: string
  slug: string
  title: string
  price: number
  listing_images: unknown
}

function nullableText(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export function homePeerToMobileCard(listing: HomePeerCardSource): MobileListingCard | null {
  return toMobileListingCard({
    id: listing.id,
    slug: listing.slug,
    title: listing.title,
    description: null,
    status: listing.status,
    price: listing.price,
    condition: listing.condition ?? null,
    section: listing.section,
    brand: null,
    model: null,
    board_type: listing.board_type ?? null,
    dimensions: null,
    city: null,
    state: null,
    shipping_available: listing.shipping_available ?? null,
    local_pickup: listing.local_pickup ?? null,
    hidden_from_site: listing.hidden_from_site ?? null,
    archived_at: listing.archived_at ?? null,
    shipping_price: null,
    board_shipping_cost_mode: null,
    listing_images: listing.listing_images ?? null,
    profiles: null,
  })
}

export function homeShopProductToMobileCard(listing: HomeShopProductSource): MobileListingCard | null {
  return homePeerToMobileCard({
    id: listing.id,
    slug: listing.slug,
    title: listing.title,
    price: listing.price,
    status: "active",
    section: "new",
    listing_images: Array.isArray(listing.listing_images)
      ? (listing.listing_images as MobileListingRow["listing_images"])
      : null,
  })
}

export function homeListingsSection(
  id: Extract<MobileHomeSection, { kind: "listings" }>["id"],
  title: string,
  rows: HomePeerCardSource[] | null | undefined,
): MobileHomeSection | null {
  const listings = (rows ?? []).flatMap((row) => {
    const card = homePeerToMobileCard(row)
    return card ? [card] : []
  })
  if (listings.length === 0) return null
  return { kind: "listings", id, title, listings }
}

export function homeBrandToMobile(brand: {
  id: string
  slug: string
  name: string
  logo_url: string | null
}): MobileHomeBrand | null {
  const logo = brandLogoDisplaySrc(brand.logo_url)
  const parsed = mobileHomeBrandSchema.safeParse({
    id: brand.id,
    slug: brand.slug,
    name: brand.name.trim(),
    logo_url: logo ? absolutePublicMediaUrl(logo) ?? null : null,
  })
  return parsed.success ? parsed.data : null
}

export function homeShopToMobile(shop: HomeShopSource): MobileHomeShop | null {
  const avatar = shop.shop_logo_url || shop.avatar_url
  const parsed = mobileHomeShopSchema.safeParse({
    id: shop.id,
    seller_slug: nullableText(shop.seller_slug),
    name: nullableText(shop.shop_name) ?? nullableText(shop.display_name) ?? "Reswell member",
    avatar_url: absoluteProfileCircleUrl(avatar),
    location_label: nullableText(shop.shop_address) ?? nullableText(shop.city) ?? nullableText(shop.location),
    verified: Boolean(shop.is_shop && shop.shop_verified),
  })
  return parsed.success ? parsed.data : null
}

/** App rails from the shared homepage feed. Empty rails are omitted. */
export function mobileSectionsFromHomeFeed(sections: HomeFeedSection[]): MobileHomeSection[] {
  return sections.flatMap((section) => {
    if (section.kind === "listings") {
      const mapped = homeListingsSection(section.id, section.title, section.listings)
      return mapped ? [mapped] : []
    }
    if (section.kind === "reswell_shop") {
      const listings = section.products.flatMap((item) => {
        const card = homeShopProductToMobileCard(item.listing)
        return card ? [card] : []
      })
      if (listings.length === 0) return []
      return [{ kind: "listings" as const, id: "reswell_shop" as const, title: section.title, listings }]
    }
    if (section.kind === "brands") {
      const brands = section.brands.flatMap((row) => {
        const mapped = homeBrandToMobile(row.brand)
        return mapped ? [mapped] : []
      })
      if (brands.length === 0) return []
      return [{ kind: "brands" as const, id: "trending_brands" as const, title: section.title, brands }]
    }
    const shops = section.shops.flatMap((shop) => {
      const mapped = homeShopToMobile(shop)
      return mapped ? [mapped] : []
    })
    if (shops.length === 0) return []
    return [{ kind: "shops" as const, id: "featured_shops" as const, title: section.title, shops }]
  })
}
