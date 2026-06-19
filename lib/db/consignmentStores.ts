import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  ConsignmentStore,
  ConsignmentStoreStatus,
  ConsignmentStoreStaffRole,
} from "@/lib/types/consignment"

type ConsignmentStoreRow = {
  id: string
  slug: string
  name: string
  owner_profile_id: string
  default_commission_bps: number
  reswell_fee_bps: number
  stripe_terminal_location_id: string | null
  intake_qr_token: string | null
  require_intake_token: boolean | null
  status: string
  created_at: string
  updated_at: string
}

const CONSIGNMENT_STORE_SELECT =
  "id, slug, name, owner_profile_id, default_commission_bps, reswell_fee_bps, stripe_terminal_location_id, intake_qr_token, require_intake_token, status, created_at, updated_at"

function mapStoreRow(row: ConsignmentStoreRow): ConsignmentStore {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    ownerProfileId: row.owner_profile_id,
    defaultCommissionBps: row.default_commission_bps,
    reswellFeeBps: row.reswell_fee_bps,
    stripeTerminalLocationId: row.stripe_terminal_location_id,
    intakeQrToken: row.intake_qr_token,
    requireIntakeToken: row.require_intake_token ?? false,
    status: (row.status as ConsignmentStoreStatus) ?? "active",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function getConsignmentStoreById(
  supabase: SupabaseClient,
  storeId: string,
): Promise<ConsignmentStore | null> {
  const { data, error } = await supabase
    .from("consignment_stores")
    .select(CONSIGNMENT_STORE_SELECT)
    .eq("id", storeId)
    .maybeSingle()

  if (error) {
    console.error("[consignmentStores] getById failed", { storeId, error })
    return null
  }
  return data ? mapStoreRow(data as ConsignmentStoreRow) : null
}

export async function getConsignmentStoreBySlug(
  supabase: SupabaseClient,
  slug: string,
): Promise<ConsignmentStore | null> {
  const { data, error } = await supabase
    .from("consignment_stores")
    .select(CONSIGNMENT_STORE_SELECT)
    .eq("slug", slug)
    .maybeSingle()

  if (error) {
    console.error("[consignmentStores] getBySlug failed", { slug, error })
    return null
  }
  return data ? mapStoreRow(data as ConsignmentStoreRow) : null
}

/** Resolves a profile's role at a store (owner inferred from the store record), or null if not staff. */
export async function getStoreStaffRole(
  supabase: SupabaseClient,
  storeId: string,
  profileId: string,
): Promise<ConsignmentStoreStaffRole | null> {
  const { data: store } = await supabase
    .from("consignment_stores")
    .select("owner_profile_id")
    .eq("id", storeId)
    .maybeSingle()

  if (store?.owner_profile_id === profileId) return "owner"

  const { data, error } = await supabase
    .from("consignment_store_staff")
    .select("role")
    .eq("store_id", storeId)
    .eq("profile_id", profileId)
    .maybeSingle()

  if (error) {
    console.error("[consignmentStores] getStoreStaffRole failed", { storeId, profileId, error })
    return null
  }
  return (data?.role as ConsignmentStoreStaffRole | undefined) ?? null
}

export type StaffStoreMembership = {
  store: ConsignmentStore
  role: ConsignmentStoreStaffRole
}

/** Stores this profile can operate (owner or on the staff roster), deduped with owner role winning. */
export async function listStoresForStaffMember(
  supabase: SupabaseClient,
  profileId: string,
): Promise<StaffStoreMembership[]> {
  const byId = new Map<string, StaffStoreMembership>()

  const { data: owned, error: ownedErr } = await supabase
    .from("consignment_stores")
    .select(CONSIGNMENT_STORE_SELECT)
    .eq("owner_profile_id", profileId)

  if (ownedErr) {
    console.error("[consignmentStores] listStoresForStaffMember owned failed", ownedErr)
  } else {
    for (const row of (owned ?? []) as ConsignmentStoreRow[]) {
      byId.set(row.id, { store: mapStoreRow(row), role: "owner" })
    }
  }

  const { data: staffRows, error: staffErr } = await supabase
    .from("consignment_store_staff")
    .select(`role, store:consignment_stores (${CONSIGNMENT_STORE_SELECT})`)
    .eq("profile_id", profileId)

  if (staffErr) {
    console.error("[consignmentStores] listStoresForStaffMember staff failed", staffErr)
  } else {
    type StaffRow = {
      role: ConsignmentStoreStaffRole
      store: ConsignmentStoreRow | ConsignmentStoreRow[] | null
    }
    for (const row of (staffRows ?? []) as StaffRow[]) {
      const storeRaw = Array.isArray(row.store) ? row.store[0] : row.store
      if (!storeRaw?.id) continue
      if (byId.has(storeRaw.id)) continue
      byId.set(storeRaw.id, {
        store: mapStoreRow(storeRaw),
        role: row.role ?? "clerk",
      })
    }
  }

  return [...byId.values()].sort((a, b) => a.store.name.localeCompare(b.store.name))
}

export type StoreInventoryItem = {
  listingId: string
  title: string
  price: number
  floorPrice: number | null
  coverUrl: string | null
  barcode: string | null
}

/** Active, visible consigned boards for a store — the sellable inventory the POS rings up. */
export async function listActiveStoreInventory(
  supabase: SupabaseClient,
  storeId: string,
  query?: string,
): Promise<StoreInventoryItem[]> {
  let q = supabase
    .from("listings")
    .select(
      "id, title, price, floor_price, barcode, listing_images (url, is_primary, sort_order)",
    )
    .eq("consignment_store_id", storeId)
    .eq("status", "active")
    .eq("hidden_from_site", false)
    .order("created_at", { ascending: false })
    .limit(60)

  const trimmed = query?.trim()
  if (trimmed) {
    // Match title, barcode, or shop SKU so a barcode scanner (which types the code + Enter into the
    // search box) jumps straight to the board. Strip PostgREST `or` delimiters from the raw scan.
    const safe = trimmed.replace(/[(),*]/g, " ").trim()
    if (safe) {
      q = q.or(`title.ilike.%${safe}%,barcode.ilike.%${safe}%,shop_sku.ilike.%${safe}%`)
    }
  }

  const { data, error } = await q
  if (error) {
    console.error("[consignmentStores] listActiveStoreInventory failed", { storeId, error })
    return []
  }

  type Row = {
    id: string
    title: string | null
    price: number | string
    floor_price: number | string | null
    barcode: string | null
    listing_images: { url: string; is_primary: boolean | null; sort_order: number | null }[] | null
  }

  return (data as Row[] | null ?? []).map((row) => {
    const images = row.listing_images ?? []
    const cover =
      images.find((img) => img.is_primary) ??
      [...images].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0] ??
      null
    return {
      listingId: row.id,
      title: row.title ?? "Untitled board",
      price: Number(row.price),
      floorPrice: row.floor_price == null ? null : Number(row.floor_price),
      coverUrl: cover?.url ?? null,
      barcode: row.barcode,
    }
  })
}

export type MyConsignmentItem = {
  listingId: string
  title: string
  slug: string | null
  coverUrl: string | null
  askingPrice: number
  floorPrice: number | null
  proposedPrice: number | null
  status: string
  intakeStatus: string | null
  storeName: string | null
  storeSlug: string | null
  createdAt: string
}

/** Boards a user has consigned to any store, across all states. Newest first. */
export async function listMyConsignments(
  supabase: SupabaseClient,
  consignorProfileId: string,
): Promise<MyConsignmentItem[]> {
  const { data, error } = await supabase
    .from("listings")
    .select(
      "id, title, slug, price, floor_price, consignor_proposed_price, status, intake_status, created_at, consignment_stores (name, slug), listing_images (url, is_primary, sort_order)",
    )
    .eq("consignor_profile_id", consignorProfileId)
    .order("created_at", { ascending: false })
    .limit(200)

  if (error) {
    console.error("[consignmentStores] listMyConsignments failed", { consignorProfileId, error })
    return []
  }

  type Row = {
    id: string
    title: string | null
    slug: string | null
    price: number | string
    floor_price: number | string | null
    consignor_proposed_price: number | string | null
    status: string
    intake_status: string | null
    created_at: string
    consignment_stores: { name: string | null; slug: string | null } | null
    listing_images: { url: string; is_primary: boolean | null; sort_order: number | null }[] | null
  }

  return (data as Row[] | null ?? []).map((row) => {
    const images = row.listing_images ?? []
    const cover =
      images.find((img) => img.is_primary) ??
      [...images].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0] ??
      null
    return {
      listingId: row.id,
      title: row.title ?? "Untitled board",
      slug: row.slug,
      coverUrl: cover?.url ?? null,
      askingPrice: Number(row.price),
      floorPrice: row.floor_price == null ? null : Number(row.floor_price),
      proposedPrice:
        row.consignor_proposed_price == null ? null : Number(row.consignor_proposed_price),
      status: row.status,
      intakeStatus: row.intake_status,
      storeName: row.consignment_stores?.name ?? null,
      storeSlug: row.consignment_stores?.slug ?? null,
      createdAt: row.created_at,
    }
  })
}

export type StoreOrderListItem = {
  orderId: string
  orderNum: string | null
  title: string
  coverUrl: string | null
  amount: number
  shopNetEarnings: number | null
  consignorEarnings: number | null
  salesChannel: string
  customerName: string | null
  createdAt: string
  status: string
  refundedAt: string | null
}

/** Recent orders attributed to a store (online + POS), newest first. RLS-gated to staff. */
export async function listStoreOrders(
  supabase: SupabaseClient,
  storeId: string,
  limit = 50,
): Promise<StoreOrderListItem[]> {
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, order_num, amount, shop_net_earnings, consignor_earnings, sales_channel, status, refunded_at, created_at, listings (title, listing_images (url, is_primary, sort_order)), store_customers (first_name, last_name)",
    )
    .eq("consignment_store_id", storeId)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    console.error("[consignmentStores] listStoreOrders failed", { storeId, error })
    return []
  }

  type Row = {
    id: string
    order_num: string | null
    amount: number | string
    shop_net_earnings: number | string | null
    consignor_earnings: number | string | null
    sales_channel: string | null
    status: string | null
    refunded_at: string | null
    created_at: string
    listings: {
      title: string | null
      listing_images: { url: string; is_primary: boolean | null; sort_order: number | null }[] | null
    } | null
    store_customers: { first_name: string | null; last_name: string | null } | null
  }

  return (data as Row[] | null ?? []).map((row) => {
    const images = row.listings?.listing_images ?? []
    const cover =
      images.find((img) => img.is_primary) ??
      [...images].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0] ??
      null
    const name = [row.store_customers?.first_name, row.store_customers?.last_name]
      .filter(Boolean)
      .join(" ")
    return {
      orderId: row.id,
      orderNum: row.order_num,
      title: row.listings?.title ?? "Board",
      coverUrl: cover?.url ?? null,
      amount: Number(row.amount),
      shopNetEarnings: row.shop_net_earnings == null ? null : Number(row.shop_net_earnings),
      consignorEarnings: row.consignor_earnings == null ? null : Number(row.consignor_earnings),
      salesChannel: row.sales_channel ?? "online",
      customerName: name || null,
      createdAt: row.created_at,
      status: row.status ?? "confirmed",
      refundedAt: row.refunded_at,
    }
  })
}

export type StoreSalesSummary = {
  orderCount: number
  grossSalesUsd: number
  shopEarningsUsd: number
  consignorPaidUsd: number
}

/**
 * Lifetime sales summary for a store. Capped scan (early-phase volumes); swap to a SQL aggregate /
 * materialized rollup when stores exceed the cap.
 */
export async function getStoreSalesSummary(
  supabase: SupabaseClient,
  storeId: string,
): Promise<StoreSalesSummary> {
  const { data, error } = await supabase
    .from("orders")
    .select("amount, shop_net_earnings, consignor_earnings")
    .eq("consignment_store_id", storeId)
    .limit(1000)

  if (error || !data) {
    if (error) console.error("[consignmentStores] getStoreSalesSummary failed", { storeId, error })
    return { orderCount: 0, grossSalesUsd: 0, shopEarningsUsd: 0, consignorPaidUsd: 0 }
  }

  type Row = { amount: number | string; shop_net_earnings: number | string | null; consignor_earnings: number | string | null }
  let gross = 0
  let shop = 0
  let consignor = 0
  for (const r of data as Row[]) {
    gross += Number(r.amount) || 0
    shop += Number(r.shop_net_earnings) || 0
    consignor += Number(r.consignor_earnings) || 0
  }
  return {
    orderCount: data.length,
    grossSalesUsd: Math.round(gross * 100) / 100,
    shopEarningsUsd: Math.round(shop * 100) / 100,
    consignorPaidUsd: Math.round(consignor * 100) / 100,
  }
}

export type StoreCustomerListItem = {
  id: string
  firstName: string
  lastName: string | null
  email: string
  phoneE164: string | null
  createdAt: string
}

/** A store's captured customer list, newest first. RLS-gated to staff. */
export async function listStoreCustomers(
  supabase: SupabaseClient,
  storeId: string,
  limit = 100,
): Promise<StoreCustomerListItem[]> {
  const { data, error } = await supabase
    .from("store_customers")
    .select("id, first_name, last_name, email, phone_e164, created_at")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    console.error("[consignmentStores] listStoreCustomers failed", { storeId, error })
    return []
  }

  type Row = {
    id: string
    first_name: string
    last_name: string | null
    email: string
    phone_e164: string | null
    created_at: string
  }

  return (data as Row[] | null ?? []).map((row) => ({
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phoneE164: row.phone_e164,
    createdAt: row.created_at,
  }))
}

export type PendingIntakeListItem = {
  intakeId: string
  listingId: string | null
  title: string
  coverUrl: string | null
  condition: string | null
  dimensions: string | null
  boardType: string | null
  consignorProposedPrice: number | null
  floorPrice: number | null
  createdAt: string
}

/** Pending consignment intakes for a store, with the draft listing's display fields. RLS-gated to staff. */
export async function listPendingIntakesForStore(
  supabase: SupabaseClient,
  storeId: string,
): Promise<PendingIntakeListItem[]> {
  const { data, error } = await supabase
    .from("consignment_intakes")
    .select(
      "id, listing_id, consignor_proposed_price, floor_price, created_at, listings (title, condition, dimensions, board_type, listing_images (url, is_primary, sort_order))",
    )
    .eq("store_id", storeId)
    .eq("status", "pending_approval")
    .order("created_at", { ascending: true })

  if (error) {
    console.error("[consignmentStores] listPendingIntakesForStore failed", { storeId, error })
    return []
  }

  type Row = {
    id: string
    listing_id: string | null
    consignor_proposed_price: number | string | null
    floor_price: number | string | null
    created_at: string
    listings: {
      title: string | null
      condition: string | null
      dimensions: string | null
      board_type: string | null
      listing_images: { url: string; is_primary: boolean | null; sort_order: number | null }[] | null
    } | null
  }

  return (data as Row[] | null ?? []).map((row) => {
    const images = row.listings?.listing_images ?? []
    const cover =
      images.find((img) => img.is_primary) ??
      [...images].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0] ??
      null
    return {
      intakeId: row.id,
      listingId: row.listing_id,
      title: row.listings?.title ?? "Untitled board",
      coverUrl: cover?.url ?? null,
      condition: row.listings?.condition ?? null,
      dimensions: row.listings?.dimensions ?? null,
      boardType: row.listings?.board_type ?? null,
      consignorProposedPrice:
        row.consignor_proposed_price == null ? null : Number(row.consignor_proposed_price),
      floorPrice: row.floor_price == null ? null : Number(row.floor_price),
      createdAt: row.created_at,
    }
  })
}
