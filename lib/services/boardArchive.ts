import type { SupabaseClient } from "@supabase/supabase-js"
import {
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
  const photoUrls = orderedImages
    .map((image) => listingTitleThumbnailSrc([image]))
    .filter((url) => url.length > 0)

  return {
    id: row.id,
    listingId,
    title: listing?.title?.trim() || "Untitled board",
    href: listingDetailHref({ id: listingId, slug: listing?.slug }),
    status,
    statusLabel: STATUS_LABELS[status] ?? status,
    brandName: brand?.name?.trim() || "Unknown brand",
    modelName: model?.name?.trim() || "Unknown model",
    dimensions: row.dimensions?.trim() || null,
    variantSummary: formatBoardArchiveVariantSummary(variant),
    listingImageIds,
    photoUrls,
    createdAt: row.created_at,
  }
}

export async function getBoardArchivePage(
  supabase: SupabaseClient,
  input: { page?: number; query?: string },
): Promise<BoardArchivePage> {
  const query = sanitizeBoardArchiveQuery(input.query)
  const page = Math.max(1, input.page ?? 1)

  if (!query) {
    const listed = await listBoardArchivePage(supabase, { page })
    return {
      rows: listed.rows.map(mapArchiveRow),
      page,
      pageSize: BOARD_ARCHIVE_PAGE_SIZE,
      total: listed.total,
      query,
    }
  }

  const ids = await findBoardArchiveSearchIds(supabase, query)
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
  }
}
