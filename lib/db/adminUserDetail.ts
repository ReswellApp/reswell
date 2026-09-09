import type { SupabaseClient, User } from "@supabase/supabase-js"

const ADMIN_USER_DETAIL_PROFILE_SELECT = [
  "id",
  "email",
  "display_name",
  "avatar_url",
  "city",
  "location",
  "bio",
  "first_name",
  "last_name",
  "phone",
  "is_admin",
  "is_employee",
  "is_reswell_seller",
  "is_shop",
  "shop_name",
  "seller_slug",
  "shop_verified",
  "shop_verified_at",
  "sales_count",
  "created_at",
  "updated_at",
].join(", ")

const ADMIN_USER_DETAIL_LISTING_SELECT =
  "id, title, price, section, status, slug, hidden_from_site, views, created_at, listing_images(url, thumbnail_url, is_primary)"

const ADMIN_SEED_TITLE = /^admin seed/i

export type AdminUserDetailProfileRow = {
  id: string
  email: string | null
  display_name: string | null
  avatar_url: string | null
  city: string | null
  location: string | null
  bio: string | null
  first_name: string | null
  last_name: string | null
  phone: string | null
  is_admin: boolean
  is_employee: boolean
  is_reswell_seller: boolean
  is_shop: boolean
  shop_name: string | null
  seller_slug: string | null
  shop_verified: boolean
  shop_verified_at: string | null
  sales_count: number
  created_at: string
  updated_at: string
}

export type AdminUserDetailListingImage = {
  url: string
  thumbnail_url?: string | null
  is_primary?: boolean | null
}

export type AdminUserDetailListingRow = {
  id: string
  title: string
  price: number
  section: string
  status: string
  slug: string | null
  hidden_from_site: boolean | null
  views: number
  created_at: string
  listing_images: AdminUserDetailListingImage[]
}

export type AdminUserDetailOrderRow = {
  id: string
  order_num: string | null
  seller_id: string | null
  buyer_id: string | null
  amount: number
  shipping_amount: number
  status: string
  is_admin_test: boolean | null
  created_at: string
  listing_id: string | null
  listing_title: string | null
}

export type AdminUserTippedSale = {
  listingId: string
  listingPriceUsd: number
}

function num(value: unknown): number {
  if (value == null) return 0
  const n = typeof value === "number" ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}

function asBool(value: unknown): boolean {
  return value === true
}

function asText(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function normalizeProfile(row: Record<string, unknown>): AdminUserDetailProfileRow {
  return {
    id: String(row.id),
    email: asText(row.email),
    display_name: asText(row.display_name),
    avatar_url: asText(row.avatar_url),
    city: asText(row.city),
    location: asText(row.location),
    bio: asText(row.bio),
    first_name: asText(row.first_name),
    last_name: asText(row.last_name),
    phone: asText(row.phone),
    is_admin: asBool(row.is_admin),
    is_employee: asBool(row.is_employee),
    is_reswell_seller: asBool(row.is_reswell_seller),
    is_shop: asBool(row.is_shop),
    shop_name: asText(row.shop_name),
    seller_slug: asText(row.seller_slug),
    shop_verified: asBool(row.shop_verified),
    shop_verified_at: asText(row.shop_verified_at),
    sales_count: num(row.sales_count),
    created_at: typeof row.created_at === "string" ? row.created_at : "",
    updated_at: typeof row.updated_at === "string" ? row.updated_at : "",
  }
}

export async function dbGetAdminUserDetailProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<
  | { ok: true; profile: AdminUserDetailProfileRow }
  | { ok: false; message: string; status: 404 | 500 }
> {
  const { data, error } = await supabase
    .from("profiles")
    .select(ADMIN_USER_DETAIL_PROFILE_SELECT)
    .eq("id", userId)
    .maybeSingle()

  if (error) {
    console.error("[admin user detail] profile", error)
    return { ok: false, message: "Could not load user", status: 500 }
  }
  if (!data) {
    return { ok: false, message: "User not found", status: 404 }
  }

  return { ok: true, profile: normalizeProfile(data as unknown as Record<string, unknown>) }
}

export async function dbFindAdminUserDetailProfileByEmail(
  supabase: SupabaseClient,
  email: string,
): Promise<AdminUserDetailProfileRow | null> {
  const normalized = email.trim().toLowerCase()
  if (!normalized) return null

  const { data, error } = await supabase
    .from("profiles")
    .select(ADMIN_USER_DETAIL_PROFILE_SELECT)
    .eq("email", normalized)
    .limit(1)
    .maybeSingle()

  if (error || !data) {
    if (error) console.error("[admin user detail] profile by email", error)
    return null
  }
  return normalizeProfile(data as unknown as Record<string, unknown>)
}

export async function dbGetAdminUserListingCounts(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ total: number; active: number; sold: number }> {
  const base = () =>
    supabase
      .from("listings")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)

  const [total, active, sold] = await Promise.all([
    base(),
    base().eq("status", "active"),
    base().eq("status", "sold"),
  ])
  return {
    total: total.error ? 0 : total.count ?? 0,
    active: active.error ? 0 : active.count ?? 0,
    sold: sold.error ? 0 : sold.count ?? 0,
  }
}

export async function dbListAdminUserDetailListings(
  supabase: SupabaseClient,
  userId: string,
): Promise<
  | { ok: true; listings: AdminUserDetailListingRow[] }
  | { ok: false; message: string }
> {
  const { data, error } = await supabase
    .from("listings")
    .select(ADMIN_USER_DETAIL_LISTING_SELECT)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("[admin user detail] listings", error)
    return { ok: false, message: "Could not load listings" }
  }

  const listings = (data ?? []).map((row) => {
    const record = row as Record<string, unknown>
    const images = Array.isArray(record.listing_images)
      ? (record.listing_images as AdminUserDetailListingImage[])
      : []
    return {
      id: String(record.id),
      title: typeof record.title === "string" ? record.title : "",
      price: num(record.price),
      section: typeof record.section === "string" ? record.section : "",
      status: typeof record.status === "string" ? record.status : "",
      slug: asText(record.slug),
      hidden_from_site: record.hidden_from_site === true,
      views: Math.max(0, Math.round(num(record.views))),
      created_at: typeof record.created_at === "string" ? record.created_at : "",
      listing_images: images,
    } satisfies AdminUserDetailListingRow
  })

  return { ok: true, listings }
}

export async function dbGetAdminUserAuthUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<User | null> {
  const { data, error } = await supabase.auth.admin.getUserById(userId)
  if (error) {
    console.error("[admin user detail] auth user", error)
    return null
  }
  return data.user ?? null
}

export async function dbListAdminUserDetailOrders(
  supabase: SupabaseClient,
  userId: string,
  limit = 500,
): Promise<AdminUserDetailOrderRow[]> {
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, order_num, seller_id, buyer_id, amount, shipping_amount, status, is_admin_test, created_at, listing_id, listings(title)",
    )
    .or(`seller_id.eq.${userId},buyer_id.eq.${userId}`)
    .eq("is_admin_test", false)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    console.error("[admin user detail] orders", error)
    return []
  }

  return (data ?? []).map((row) => {
    const record = row as Record<string, unknown>
    const listing = record.listings
    let listingTitle: string | null = null
    if (listing && typeof listing === "object" && !Array.isArray(listing)) {
      listingTitle = asText((listing as { title?: unknown }).title)
    }
    return {
      id: String(record.id),
      order_num: asText(record.order_num),
      seller_id: asText(record.seller_id),
      buyer_id: asText(record.buyer_id),
      amount: num(record.amount),
      shipping_amount: num(record.shipping_amount),
      status: typeof record.status === "string" ? record.status : "",
      is_admin_test: record.is_admin_test === true,
      created_at: typeof record.created_at === "string" ? record.created_at : "",
      listing_id: asText(record.listing_id),
      listing_title: listingTitle,
    }
  })
}

export async function dbListAdminUserTippedSales(
  supabase: SupabaseClient,
  sellerUserId: string,
): Promise<AdminUserTippedSale[]> {
  const { data: tips, error: tipsError } = await supabase
    .from("seller_sale_tips")
    .select("listing_id")
    .eq("seller_user_id", sellerUserId)
    .eq("status", "succeeded")
    .limit(2000)

  if (tipsError) {
    console.error("[admin user detail] tipped sales", tipsError)
    return []
  }

  const listingIds = [
    ...new Set(
      (tips ?? [])
        .map((row) => (typeof row.listing_id === "string" ? row.listing_id : null))
        .filter((id): id is string => Boolean(id)),
    ),
  ]
  if (listingIds.length === 0) return []

  const { data: checkoutRows, error: checkoutError } = await supabase
    .from("orders")
    .select("listing_id")
    .in("listing_id", listingIds)
    .eq("status", "confirmed")
    .eq("is_admin_test", false)

  if (checkoutError) {
    console.error("[admin user detail] tipped checkout overlap", checkoutError)
  }

  const confirmedListingIds = new Set(
    (checkoutRows ?? [])
      .map((row) => (typeof row.listing_id === "string" ? row.listing_id : null))
      .filter((id): id is string => Boolean(id)),
  )

  const remaining = listingIds.filter((id) => !confirmedListingIds.has(id))
  if (remaining.length === 0) return []

  const { data: listings, error: listingsError } = await supabase
    .from("listings")
    .select("id, title, price, status")
    .in("id", remaining)

  if (listingsError) {
    console.error("[admin user detail] tipped listing prices", listingsError)
    return []
  }

  const sales: AdminUserTippedSale[] = []
  for (const listing of listings ?? []) {
    const title = typeof listing.title === "string" ? listing.title : ""
    if (ADMIN_SEED_TITLE.test(title)) continue
    if (listing.status !== "sold") continue
    const listingPriceUsd = num(listing.price)
    if (listingPriceUsd <= 0) continue
    sales.push({
      listingId: String(listing.id),
      listingPriceUsd,
    })
  }
  return sales
}
