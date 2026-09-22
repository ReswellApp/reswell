import { createServiceRoleClient } from "@/lib/supabase/server"
import {
  downloadListingImageForZip,
  startFacebookMarketplaceListingPhotosZip,
  zipArchiveToWebStream,
} from "@/lib/facebook-marketplace/build-listing-photos-zip"
import {
  DEFAULT_HAYDEN_SHOP_NAME,
  buildInstagramPostCaption,
  formatInstagramPrice,
  orderedListingFullImageUrls,
} from "@/lib/instagram-post/build-caption"
import {
  getHaydenShopInstagramListing,
  getHaydenShopInstagramSeller,
  listHaydenShopInstagramListings,
  type HaydenShopInstagramListingRow,
  type HaydenShopInstagramSeller,
} from "@/lib/db/hayden-shop-instagram"
import { listingDetailHref } from "@/lib/listing-href"
import { listingTitleThumbnailSrc } from "@/lib/listing-image-display"
import { proxiedListingImageSrc } from "@/lib/listing-media-proxy-url"
import { isPeerListingSection, PEER_LISTING_SECTION_LABELS } from "@/lib/peer-listing-sections"
import { resolveHaydenShopUserId } from "@/lib/services/pnlHaydenShopSale"
import { publicSiteOriginForEmail } from "@/lib/public-site-origin"
import { slugify } from "@/lib/slugify"

export type HaydenShopInstagramListingPreview = {
  id: string
  slug: string | null
  title: string
  price: number
  price_label: string
  section: string
  section_label: string
  thumbnail_url: string
  image_count: number
}

export type HaydenShopInstagramPhoto = {
  index: number
  preview_url: string
  download_path: string
}

export type HaydenShopInstagramListingPack = HaydenShopInstagramListingPreview & {
  caption: string
  listing_path: string
  listing_url: string
  photos: HaydenShopInstagramPhoto[]
}

function serviceClient() {
  try {
    return createServiceRoleClient()
  } catch (error) {
    console.error("haydenShopInstagramPost: missing service role", error)
    return null
  }
}

function sectionLabel(section: string): string {
  if (isPeerListingSection(section)) return PEER_LISTING_SECTION_LABELS[section]
  return section
}

function shopDisplayName(seller: HaydenShopInstagramSeller): string {
  return seller.shop_name?.trim() || seller.display_name?.trim() || DEFAULT_HAYDEN_SHOP_NAME
}

function listingPath(listing: Pick<HaydenShopInstagramListingRow, "id" | "slug" | "section">): string {
  return listingDetailHref({
    id: listing.id,
    slug: listing.slug,
    section: listing.section,
  })
}

function listingPublicUrl(path: string): string {
  return `${publicSiteOriginForEmail()}${path}`
}

function toPreview(listing: HaydenShopInstagramListingRow): HaydenShopInstagramListingPreview {
  return {
    id: listing.id,
    slug: listing.slug,
    title: listing.title,
    price: listing.price,
    price_label: formatInstagramPrice(listing.price),
    section: listing.section,
    section_label: sectionLabel(listing.section),
    thumbnail_url: listingTitleThumbnailSrc(listing.listing_images),
    image_count: orderedListingFullImageUrls(listing.listing_images).length,
  }
}

function toPack(listing: HaydenShopInstagramListingRow, seller: HaydenShopInstagramSeller): HaydenShopInstagramListingPack {
  const path = listingPath(listing)
  const imageUrls = orderedListingFullImageUrls(listing.listing_images)
  return {
    ...toPreview(listing),
    listing_path: path,
    listing_url: listingPublicUrl(path),
    caption: buildInstagramPostCaption({
      title: listing.title,
      description: listing.description,
      price: listing.price,
      section: listing.section,
      board_type: listing.board_type,
      brand: listing.brand,
      model: listing.model,
      condition: listing.condition,
      dimensions: listing.dimensions,
      construction: listing.construction,
      fin_system: listing.fin_system,
      fins_setup: listing.fins_setup,
      fins_included: listing.fins_included,
      listingUrl: listingPublicUrl(path),
      shopName: shopDisplayName(seller),
    }),
    photos: imageUrls.map((url, index) => ({
      index,
      preview_url: proxiedListingImageSrc(url) || url,
      download_path: `/api/admin/hayden-shop/instagram/listings/${listing.id}/photo?index=${index}`,
    })),
  }
}

async function requireHaydenShop(supabase: NonNullable<ReturnType<typeof serviceClient>>) {
  const userId = await resolveHaydenShopUserId(supabase)
  if (!userId) {
    return { ok: false as const, error: "Hayden's Shop seller is not configured", status: 500 }
  }
  const seller = await getHaydenShopInstagramSeller(supabase, userId)
  if (!seller) {
    return { ok: false as const, error: "Hayden's Shop profile was not found", status: 404 }
  }
  return { ok: true as const, userId, seller }
}

export async function listHaydenShopInstagramPostService(): Promise<
  | {
      ok: true
      shop: { name: string; seller_slug: string | null }
      listings: HaydenShopInstagramListingPreview[]
    }
  | { ok: false; error: string; status?: number }
> {
  const supabase = serviceClient()
  if (!supabase) return { ok: false, error: "Server configuration error", status: 500 }

  try {
    const shop = await requireHaydenShop(supabase)
    if (!shop.ok) return shop
    const rows = await listHaydenShopInstagramListings(supabase, shop.userId)
    return {
      ok: true,
      shop: { name: shopDisplayName(shop.seller), seller_slug: shop.seller.seller_slug },
      listings: rows.map(toPreview),
    }
  } catch (error) {
    console.error("listHaydenShopInstagramPostService:", error)
    return { ok: false, error: "Could not load Hayden's Shop listings", status: 500 }
  }
}

export async function getHaydenShopInstagramPostService(
  listingId: string,
): Promise<
  { ok: true; listing: HaydenShopInstagramListingPack } | { ok: false; error: string; status?: number }
> {
  const supabase = serviceClient()
  if (!supabase) return { ok: false, error: "Server configuration error", status: 500 }

  try {
    const shop = await requireHaydenShop(supabase)
    if (!shop.ok) return shop
    const row = await getHaydenShopInstagramListing(supabase, shop.userId, listingId)
    if (!row) {
      return { ok: false, error: "This listing is not in Hayden's Shop", status: 404 }
    }
    return { ok: true, listing: toPack(row, shop.seller) }
  } catch (error) {
    console.error("getHaydenShopInstagramPostService:", error)
    return { ok: false, error: "Could not load this listing", status: 500 }
  }
}

function listingFileSlug(listing: Pick<HaydenShopInstagramListingRow, "id" | "title" | "slug">): string {
  return slugify(listing.title) || slugify(listing.slug ?? "") || listing.id.slice(0, 8)
}

export async function downloadHaydenShopInstagramPhotoService(
  listingId: string,
  index: number,
): Promise<
  | { ok: true; bytes: Buffer; filename: string; contentType: string }
  | { ok: false; error: string; status?: number }
> {
  const supabase = serviceClient()
  if (!supabase) return { ok: false, error: "Server configuration error", status: 500 }

  try {
    const shop = await requireHaydenShop(supabase)
    if (!shop.ok) return shop
    const row = await getHaydenShopInstagramListing(supabase, shop.userId, listingId)
    if (!row) {
      return { ok: false, error: "This listing is not in Hayden's Shop", status: 404 }
    }
    const urls = orderedListingFullImageUrls(row.listing_images)
    const url = urls[index]
    if (!url) {
      return { ok: false, error: "Photo not found", status: 404 }
    }
    const downloaded = await downloadListingImageForZip(supabase, url)
    if (!downloaded) {
      return { ok: false, error: "Could not download that photo", status: 502 }
    }
    const width = Math.max(2, String(urls.length).length)
    const filename = `${listingFileSlug(row)}-${String(index + 1).padStart(width, "0")}.${downloaded.extension}`
    const contentType =
      downloaded.extension === "png"
        ? "image/png"
        : downloaded.extension === "webp"
          ? "image/webp"
          : downloaded.extension === "gif"
            ? "image/gif"
            : "image/jpeg"
    return { ok: true, bytes: downloaded.bytes, filename, contentType }
  } catch (error) {
    console.error("downloadHaydenShopInstagramPhotoService:", error)
    return { ok: false, error: "Could not download that photo", status: 500 }
  }
}

export async function downloadHaydenShopInstagramPhotosZipService(
  listingId: string,
): Promise<
  | {
      ok: true
      stream: ReadableStream<Uint8Array>
      filename: string
      imageCount: number
    }
  | { ok: false; error: string; status?: number }
> {
  const supabase = serviceClient()
  if (!supabase) return { ok: false, error: "Server configuration error", status: 500 }

  try {
    const shop = await requireHaydenShop(supabase)
    if (!shop.ok) return shop
    const row = await getHaydenShopInstagramListing(supabase, shop.userId, listingId)
    if (!row) {
      return { ok: false, error: "This listing is not in Hayden's Shop", status: 404 }
    }
    const image_urls = orderedListingFullImageUrls(row.listing_images)
    if (image_urls.length === 0) {
      return { ok: false, error: "This listing has no photos to download", status: 400 }
    }

    const slug = listingFileSlug(row)
    const stamp = new Date().toISOString().slice(0, 10)
    const filename = `hayden-shop-instagram-${slug}-${stamp}.zip`
    const { archive } = startFacebookMarketplaceListingPhotosZip({
      rootFolder: slug,
      listings: [
        {
          id: row.id,
          slug: row.slug,
          title: row.title,
          price: row.price,
          image_urls,
        },
      ],
      downloadImage: (url) => downloadListingImageForZip(supabase, url),
    })

    return {
      ok: true,
      stream: zipArchiveToWebStream(archive),
      filename,
      imageCount: image_urls.length,
    }
  } catch (error) {
    console.error("downloadHaydenShopInstagramPhotosZipService:", error)
    return { ok: false, error: "Could not build the photo zip", status: 500 }
  }
}
