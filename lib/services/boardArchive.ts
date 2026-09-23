import type { SupabaseClient } from "@supabase/supabase-js"
import {
  countBoardArchiveTotals,
  findBoardArchiveSearchIds,
  listBoardArchivePage,
  type BoardArchiveDbImage,
  type BoardArchiveDbListing,
  type BoardArchiveDbRow,
  type BoardArchiveDbVariant,
} from "@/lib/db/board-archive"
import { listingDetailHref } from "@/lib/listing-href"
import { listingTitleThumbnailSrc } from "@/lib/listing-image-display"
import {
  formatBoardArchiveVariantSummary,
  sanitizeBoardArchiveQuery,
} from "@/lib/services/boardArchiveDisplay"
import {
  BOARD_ARCHIVE_PAGE_SIZE,
  type BoardArchivePage,
  type BoardArchiveRow,
} from "@/lib/types/board-archive"

const STATUS_LABELS: Record<string, string> = {
  active: "Live",
  sold: "Sold",
  pending: "Pending",
  pending_sale: "Pending sale",
}

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function many<T>(value: T | T[] | null | undefined): T[] {
  if (Array.isArray(value)) return value
  if (value == null) return []
  return [value]
}

function priceLabel(value: number | string | null | undefined): string | null {
  if (value == null || value === "") return null
  const amount = typeof value === "number" ? value : Number.parseFloat(String(value))
  if (!Number.isFinite(amount)) return null
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  })
}

function mapArchiveRow(row: BoardArchiveDbRow): BoardArchiveRow {
  const listing = one<BoardArchiveDbListing>(row.listings)
  const brand = one(row.brands)
  const model = one(row.brand_models)
  const variant = one<BoardArchiveDbVariant>(row.brand_model_variants)
  const listingImageIds = Array.isArray(row.listing_image_ids) ? row.listing_image_ids : []
  const imagesById = new Map(
    many<BoardArchiveDbImage>(listing?.listing_images).map((image) => [image.id, image]),
  )
  const orderedImages = listingImageIds.flatMap((id) => {
    const image = imagesById.get(id)
    return image ? [image] : []
  })
  const listingId = listing?.id ?? row.listing_id
  const status = listing?.status?.trim() || "active"
  const thumb = listingTitleThumbnailSrc(orderedImages)

  return {
    id: row.id,
    listingId,
    title: listing?.title?.trim() || "Untitled board",
    href: listingDetailHref({ id: listingId, slug: listing?.slug }),
    status,
    statusLabel: STATUS_LABELS[status] ?? status,
    priceLabel: priceLabel(listing?.price),
    brandName: brand?.name?.trim() || "Unknown brand",
    modelName: model?.name?.trim() || "Unknown model",
    dimensions: row.dimensions?.trim() || null,
    variantSummary: formatBoardArchiveVariantSummary(variant),
    listingImageIds,
    photoCount: listingImageIds.length,
    thumbnailUrl: thumb || null,
    createdAt: row.created_at,
  }
}

export async function getBoardArchivePage(
  supabase: SupabaseClient,
  input: { page?: number; query?: string },
): Promise<BoardArchivePage> {
  const query = sanitizeBoardArchiveQuery(input.query)
  const page = Math.max(1, input.page ?? 1)
  const totalsPromise = countBoardArchiveTotals(supabase)

  if (!query) {
    const [totals, listed] = await Promise.all([
      totalsPromise,
      listBoardArchivePage(supabase, { page }),
    ])
    return {
      rows: listed.rows.map(mapArchiveRow),
      page,
      pageSize: BOARD_ARCHIVE_PAGE_SIZE,
      total: listed.total,
      query,
      ...totals,
    }
  }

  const [totals, ids] = await Promise.all([
    totalsPromise,
    findBoardArchiveSearchIds(supabase, query),
  ])
  const listed = await listBoardArchivePage(supabase, {
    page,
    brandIds: ids.brandIds,
    modelIds: ids.modelIds,
    listingIds: ids.listingIds,
    restrictToSearch: true,
  })

  return {
    rows: listed.rows.map(mapArchiveRow),
    page,
    pageSize: BOARD_ARCHIVE_PAGE_SIZE,
    total: listed.total,
    query,
    ...totals,
  }
}
