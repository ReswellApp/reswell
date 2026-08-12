import { createServiceRoleClient } from "@/lib/supabase/server"

const IN_CHUNK = 150
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type AdSalesListingLookup = {
  id: string
  title: string | null
  slug: string | null
  status: string | null
  section: string | null
  thumbnailUrl: string | null
}

export type AdSalesOrderLookup = {
  id: string
  orderNum: string | null
  status: string
  amount: number
  createdAt: string
  isAdminTest: boolean
}

type RawListingImage = {
  url: string | null
  thumbnail_url: string | null
  is_primary: boolean | null
  sort_order: number | null
}

function chunk<T>(values: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < values.length; i += size) out.push(values.slice(i, i + size))
  return out
}

export function isListingUuid(value: string): boolean {
  return UUID_RE.test(value.trim())
}

function pickThumbnail(images: RawListingImage[] | null | undefined): string | null {
  if (!images || images.length === 0) return null
  const sorted = [...images].sort((a, b) => {
    if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1
    return (a.sort_order ?? 0) - (b.sort_order ?? 0)
  })
  const best = sorted[0]
  return best?.thumbnail_url ?? best?.url ?? null
}

export async function fetchListingsForAdSales(
  listingIds: string[],
): Promise<Map<string, AdSalesListingLookup>> {
  const ids = [...new Set(listingIds.map((id) => id.trim()).filter(isListingUuid))]
  const map = new Map<string, AdSalesListingLookup>()
  if (ids.length === 0) return map

  const supabase = createServiceRoleClient()
  for (const group of chunk(ids, IN_CHUNK)) {
    const { data, error } = await supabase
      .from("listings")
      .select("id, title, slug, status, section, listing_images (thumbnail_url, url, is_primary, sort_order)")
      .in("id", group)
    if (error) {
      console.error("[adAttributedSales] listings:", error.message)
      continue
    }
    for (const row of data ?? []) {
      const id = typeof row.id === "string" ? row.id : ""
      if (!id) continue
      map.set(id, {
        id,
        title: typeof row.title === "string" ? row.title : null,
        slug: typeof row.slug === "string" ? row.slug : null,
        status: typeof row.status === "string" ? row.status : null,
        section: typeof row.section === "string" ? row.section : null,
        thumbnailUrl: pickThumbnail(row.listing_images as RawListingImage[] | null),
      })
    }
  }
  return map
}

export async function fetchOrdersForAdSales(
  orderIds: string[],
): Promise<Map<string, AdSalesOrderLookup>> {
  const ids = [...new Set(orderIds.map((id) => id.trim()).filter(isListingUuid))]
  const map = new Map<string, AdSalesOrderLookup>()
  if (ids.length === 0) return map

  const supabase = createServiceRoleClient()
  for (const group of chunk(ids, IN_CHUNK)) {
    const { data, error } = await supabase
      .from("orders")
      .select("id, order_num, status, amount, created_at, is_admin_test")
      .in("id", group)
    if (error) {
      console.error("[adAttributedSales] orders:", error.message)
      continue
    }
    for (const row of data ?? []) {
      const id = typeof row.id === "string" ? row.id : ""
      if (!id) continue
      const amount = Number(row.amount)
      map.set(id, {
        id,
        orderNum: typeof row.order_num === "string" ? row.order_num : null,
        status: typeof row.status === "string" ? row.status : "unknown",
        amount: Number.isFinite(amount) ? amount : 0,
        createdAt: typeof row.created_at === "string" ? row.created_at : "",
        isAdminTest: row.is_admin_test === true,
      })
    }
  }
  return map
}
