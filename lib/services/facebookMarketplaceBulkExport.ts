import { createServiceRoleClient } from "@/lib/supabase/server"
import { FACEBOOK_MARKETPLACE_BULK_UPLOAD_MAX } from "@/lib/facebook-marketplace/categories"
import { buildFacebookMarketplaceBulkUploadXlsx } from "@/lib/facebook-marketplace/build-bulk-upload-xlsx"
import {
  downloadListingImageForZip,
  startFacebookMarketplaceListingPhotosZip,
  zipArchiveToWebStream,
  type FacebookMarketplacePhotoZipListing,
} from "@/lib/facebook-marketplace/build-listing-photos-zip"
import { mapListingToFacebookMarketplaceRow } from "@/lib/facebook-marketplace/map-listing"
import { listingTitleThumbnailSrc } from "@/lib/listing-image-display"
import { PEER_LISTING_SECTION_LABELS, isPeerListingSection } from "@/lib/peer-listing-sections"
import {
  getFacebookMarketplaceBulkSellerProfile,
  listActiveListingsForFacebookMarketplaceBulkExport,
  listSelectedListingsForFacebookMarketplaceBulkExport,
  searchSellersForFacebookMarketplaceBulkExport,
  type FacebookMarketplaceBulkListingRow,
  type FacebookMarketplaceBulkSellerHit,
} from "@/lib/db/facebook-marketplace-bulk-export"

export type { FacebookMarketplaceBulkSellerHit }

export type FacebookMarketplaceBulkListingPreview = {
  id: string
  slug: string | null
  title: string
  price: number
  section: string
  section_label: string
  condition: string | null
  thumbnail_url: string
  image_count: number
  facebook: {
    title: string
    price: number
    condition: string
    category: string
  }
}

function serviceClient() {
  try {
    return createServiceRoleClient()
  } catch (error) {
    console.error("facebookMarketplaceBulkExport: missing service role", error)
    return null
  }
}

function sectionLabel(section: string): string {
  if (isPeerListingSection(section)) return PEER_LISTING_SECTION_LABELS[section]
  return section
}

function fullListingImageUrls(
  images: FacebookMarketplaceBulkListingRow["listing_images"],
): string[] {
  const list = [...(images ?? [])].sort((a, b) => {
    if (Boolean(a.is_primary) !== Boolean(b.is_primary)) return a.is_primary ? -1 : 1
    return (a.sort_order ?? 999) - (b.sort_order ?? 999)
  })
  const urls: string[] = []
  const seen = new Set<string>()
  for (const image of list) {
    const url = image.url?.trim()
    if (!url || seen.has(url)) continue
    seen.add(url)
    urls.push(url)
  }
  return urls
}

function toPreview(listing: FacebookMarketplaceBulkListingRow): FacebookMarketplaceBulkListingPreview | null {
  const facebook = mapListingToFacebookMarketplaceRow(listing)
  if (!facebook) return null
  return {
    id: listing.id,
    slug: listing.slug,
    title: listing.title,
    price: listing.price,
    section: listing.section,
    section_label: sectionLabel(listing.section),
    condition: listing.condition,
    thumbnail_url: listingTitleThumbnailSrc(listing.listing_images),
    image_count: fullListingImageUrls(listing.listing_images).length,
    facebook: {
      title: facebook.title,
      price: facebook.price,
      condition: facebook.condition,
      category: facebook.category,
    },
  }
}

export async function searchFacebookMarketplaceBulkSellersService(
  query: string,
  limit: number,
): Promise<{ ok: true; hits: FacebookMarketplaceBulkSellerHit[] } | { ok: false; error: string }> {
  const supabase = serviceClient()
  if (!supabase) return { ok: false, error: "Server configuration error" }

  try {
    const hits = await searchSellersForFacebookMarketplaceBulkExport(supabase, query, limit)
    return { ok: true, hits }
  } catch (error) {
    console.error("searchFacebookMarketplaceBulkSellersService:", error)
    return { ok: false, error: "Could not search sellers" }
  }
}

export async function listFacebookMarketplaceBulkSellerListingsService(
  sellerId: string,
): Promise<
  | {
      ok: true
      seller: { id: string; seller_slug: string; display_name: string | null; shop_name: string | null }
      listings: FacebookMarketplaceBulkListingPreview[]
      skipped: number
    }
  | { ok: false; error: string; status?: number }
> {
  const supabase = serviceClient()
  if (!supabase) return { ok: false, error: "Server configuration error", status: 500 }

  try {
    const seller = await getFacebookMarketplaceBulkSellerProfile(supabase, sellerId)
    if (!seller) return { ok: false, error: "Seller not found", status: 404 }

    const rows = await listActiveListingsForFacebookMarketplaceBulkExport(supabase, sellerId)
    const listings: FacebookMarketplaceBulkListingPreview[] = []
    let skipped = 0
    for (const row of rows) {
      const preview = toPreview(row)
      if (!preview) {
        skipped += 1
        continue
      }
      listings.push(preview)
    }

    return { ok: true, seller, listings, skipped }
  } catch (error) {
    console.error("listFacebookMarketplaceBulkSellerListingsService:", error)
    return { ok: false, error: "Could not load seller listings", status: 500 }
  }
}

function sellerFileLabel(seller: {
  seller_slug: string
  shop_name: string | null
  display_name: string | null
}): string {
  const raw = seller.shop_name?.trim() || seller.display_name?.trim() || seller.seller_slug
  return raw.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || seller.seller_slug
}

export async function exportFacebookMarketplaceBulkWorkbookService(
  sellerId: string,
  listingIds: string[],
): Promise<
  | { ok: true; buffer: Buffer; filename: string; count: number }
  | { ok: false; error: string; status?: number }
> {
  const uniqueIds = [...new Set(listingIds)]
  if (uniqueIds.length > FACEBOOK_MARKETPLACE_BULK_UPLOAD_MAX) {
    return {
      ok: false,
      error: `Facebook Marketplace allows up to ${FACEBOOK_MARKETPLACE_BULK_UPLOAD_MAX} listings per file`,
      status: 400,
    }
  }

  const supabase = serviceClient()
  if (!supabase) return { ok: false, error: "Server configuration error", status: 500 }

  try {
    const seller = await getFacebookMarketplaceBulkSellerProfile(supabase, sellerId)
    if (!seller) return { ok: false, error: "Seller not found", status: 404 }

    const rows = await listSelectedListingsForFacebookMarketplaceBulkExport(
      supabase,
      sellerId,
      uniqueIds,
    )
    if (rows.length === 0) {
      return { ok: false, error: "No exportable listings matched that selection", status: 400 }
    }
    if (rows.length !== uniqueIds.length) {
      return {
        ok: false,
        error: "One or more selected listings are not active for this seller",
        status: 400,
      }
    }

    const mapped = rows.map((row) => mapListingToFacebookMarketplaceRow(row))
    if (mapped.some((row) => row == null)) {
      return { ok: false, error: "One or more listings are missing a valid price or title", status: 400 }
    }

    const buffer = await buildFacebookMarketplaceBulkUploadXlsx(
      mapped.filter((row): row is NonNullable<typeof row> => row != null),
    )
    const stamp = new Date().toISOString().slice(0, 10)
    const filename = `Marketplace_Bulk_Upload_${sellerFileLabel(seller)}_${stamp}.xlsx`

    return { ok: true, buffer, filename, count: rows.length }
  } catch (error) {
    console.error("exportFacebookMarketplaceBulkWorkbookService:", error)
    return { ok: false, error: "Could not build the Marketplace spreadsheet", status: 500 }
  }
}

export async function exportFacebookMarketplaceListingPhotosZipService(
  sellerId: string,
): Promise<
  | {
      ok: true
      stream: ReadableStream<Uint8Array>
      filename: string
      listingCount: number
      imageCount: number
    }
  | { ok: false; error: string; status?: number }
> {
  const supabase = serviceClient()
  if (!supabase) return { ok: false, error: "Server configuration error", status: 500 }

  try {
    const seller = await getFacebookMarketplaceBulkSellerProfile(supabase, sellerId)
    if (!seller) return { ok: false, error: "Seller not found", status: 404 }

    const rows = await listActiveListingsForFacebookMarketplaceBulkExport(supabase, sellerId)
    const listings: FacebookMarketplacePhotoZipListing[] = []
    for (const row of rows) {
      if (row.section !== "surfboards") continue
      const image_urls = fullListingImageUrls(row.listing_images)
      if (image_urls.length === 0) continue
      listings.push({
        id: row.id,
        slug: row.slug,
        title: row.title,
        price: row.price,
        image_urls,
      })
    }

    if (listings.length === 0) {
      return { ok: false, error: "This seller has no surfboard listing photos to download", status: 400 }
    }

    const imageCount = listings.reduce((sum, listing) => sum + listing.image_urls.length, 0)
    const stamp = new Date().toISOString().slice(0, 10)
    const label = sellerFileLabel(seller)
    const filename = `Marketplace_Listing_Photos_${label}_${stamp}.zip`
    const { archive } = startFacebookMarketplaceListingPhotosZip({
      rootFolder: `${label}-listing-photos`,
      listings,
      downloadImage: (url) => downloadListingImageForZip(supabase, url),
    })

    return {
      ok: true,
      stream: zipArchiveToWebStream(archive),
      filename,
      listingCount: listings.length,
      imageCount,
    }
  } catch (error) {
    console.error("exportFacebookMarketplaceListingPhotosZipService:", error)
    return { ok: false, error: "Could not build the listing photos zip", status: 500 }
  }
}
