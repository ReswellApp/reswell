import { createClient } from "@/lib/supabase/server"
import {
  deletePnlEntryRow,
  insertPnlEntry,
  listAttachedListingIds,
  listAttachedOrderIds,
  listHaydenShopListingsForPnl,
  listPnlEntries,
  listReswellOrdersForUser,
  updatePnlEntryRow,
  type PnlEntryInsert,
  type PnlEntryRow,
  type PnlEntryUpdate,
  type ReswellListingOption,
} from "@/lib/db/pnl"
import {
  attachReswellListingSchema,
  attachReswellOrderSchema,
  createPnlEntrySchema,
  deletePnlEntrySchema,
  updatePnlEntriesSchema,
  updatePnlEntrySchema,
  type UpdatePnlEntryInput,
} from "@/lib/validations/pnl"
import { haydenShopListingToPnlInsert } from "@/lib/pnl-hayden-shop-sale"
import { attachHaydenShopActiveAndSoldListings } from "@/lib/services/pnlHaydenShopAttach"
import { pnlCatalogClient, resolveHaydenShopUserId } from "@/lib/services/pnlHaydenShopSale"
import { requireStaffUserId, type PnlServiceError } from "@/lib/services/pnlAuth"

type ServiceError = PnlServiceError

function nullable(value: string | undefined): string | null {
  return value === undefined || value === "" ? null : value
}

export async function listPnlEntriesService(): Promise<{ data: PnlEntryRow[] } | ServiceError> {
  const staff = await requireStaffUserId()
  if ("error" in staff) return staff
  try {
    const supabase = await createClient()
    const data = await listPnlEntries(supabase)
    return { data }
  } catch {
    return { error: "Could not load inventory." }
  }
}

export async function createPnlEntryService(
  raw: unknown,
): Promise<{ data: PnlEntryRow } | ServiceError> {
  const staff = await requireStaffUserId()
  if ("error" in staff) return staff

  const parsed = createPnlEntrySchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid entry." }
  }
  const input = parsed.data

  const values: PnlEntryInsert = {
    board_name: input.boardName,
    category: nullable(input.category),
    status: input.status,
    source_kind: input.sourceKind,
    bought_from: nullable(input.boughtFrom),
    purchase_price: input.purchasePrice,
    purchase_date: nullable(input.purchaseDate),
    asking_price: input.askingPrice ?? null,
    sale_price: input.salePrice ?? null,
    sale_date: nullable(input.saleDate),
    shipping_cost: input.shippingCost,
    platform_fee: input.platformFee,
    other_costs: input.otherCosts,
    notes: nullable(input.notes),
    created_by: staff.userId,
  }

  try {
    const supabase = await createClient()
    const data = await insertPnlEntry(supabase, values)
    return { data }
  } catch {
    return { error: "Could not add this board." }
  }
}

function valuesFromUpdateInput(input: Omit<UpdatePnlEntryInput, "id">): PnlEntryUpdate {
  const values: PnlEntryUpdate = {}
  if (input.boardName !== undefined) values.board_name = input.boardName
  if (input.category !== undefined) values.category = input.category || null
  if (input.status !== undefined) values.status = input.status
  if (input.sourceKind !== undefined) values.source_kind = input.sourceKind
  if (input.boughtFrom !== undefined) values.bought_from = input.boughtFrom || null
  if (input.purchasePrice !== undefined) values.purchase_price = input.purchasePrice
  if (input.purchaseDate !== undefined) values.purchase_date = input.purchaseDate || null
  if (input.askingPrice !== undefined) values.asking_price = input.askingPrice
  if (input.salePrice !== undefined) values.sale_price = input.salePrice
  if (input.saleDate !== undefined) values.sale_date = input.saleDate || null
  if (input.shippingCost !== undefined) values.shipping_cost = input.shippingCost
  if (input.platformFee !== undefined) values.platform_fee = input.platformFee
  if (input.otherCosts !== undefined) values.other_costs = input.otherCosts
  if (input.notes !== undefined) values.notes = input.notes || null
  return values
}

export async function updatePnlEntryService(
  raw: unknown,
): Promise<{ data: PnlEntryRow } | ServiceError> {
  const staff = await requireStaffUserId()
  if ("error" in staff) return staff

  const parsed = updatePnlEntrySchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid update." }
  }
  const { id, ...input } = parsed.data
  const values = valuesFromUpdateInput(input)
  if (Object.keys(values).length === 0) {
    return { error: "Nothing to update." }
  }

  try {
    const supabase = await createClient()
    const data = await updatePnlEntryRow(supabase, id, values)
    return { data }
  } catch {
    return { error: "Could not update this board." }
  }
}

export async function updatePnlEntriesService(
  raw: unknown,
): Promise<{ data: PnlEntryRow[] } | ServiceError> {
  const staff = await requireStaffUserId()
  if ("error" in staff) return staff

  const parsed = updatePnlEntriesSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid update." }
  }

  try {
    const supabase = await createClient()
    const data: PnlEntryRow[] = []
    const chunkSize = 20
    for (let i = 0; i < parsed.data.entries.length; i += chunkSize) {
      const chunk = parsed.data.entries.slice(i, i + chunkSize)
      const rows = await Promise.all(
        chunk.map(async (entry) => {
          const { id, ...input } = entry
          const values = valuesFromUpdateInput(input)
          if (Object.keys(values).length === 0) return null
          return updatePnlEntryRow(supabase, id, values)
        }),
      )
      for (const row of rows) {
        if (row) data.push(row)
      }
    }
    return { data }
  } catch {
    return { error: "Could not save these boards." }
  }
}

export type ReswellAttachables = {
  listings: ReswellListingOption[]
}

async function requireHaydenShopUserId(
  supabase: Parameters<typeof resolveHaydenShopUserId>[0],
): Promise<{ userId: string } | ServiceError> {
  const userId = await resolveHaydenShopUserId(supabase)
  if (!userId) return { error: "Could not find Hayden's shop." }
  return { userId }
}

export async function listReswellTransactionsService(): Promise<
  { data: ReswellAttachables } | ServiceError
> {
  const staff = await requireStaffUserId()
  if ("error" in staff) return staff
  try {
    const supabase = await createClient()
    const catalog = pnlCatalogClient(supabase)
    const shop = await requireHaydenShopUserId(catalog)
    if ("error" in shop) return shop
    const [listings, attachedListings] = await Promise.all([
      listHaydenShopListingsForPnl(catalog, shop.userId),
      listAttachedListingIds(supabase),
    ])
    return {
      data: {
        listings: listings.filter((l) => !attachedListings.has(l.listing_id)),
      },
    }
  } catch {
    return { error: "Could not load Hayden's shop inventory." }
  }
}

export async function attachReswellListingService(
  raw: unknown,
): Promise<{ data: PnlEntryRow } | ServiceError> {
  const staff = await requireStaffUserId()
  if ("error" in staff) return staff

  const parsed = attachReswellListingSchema.safeParse(raw)
  if (!parsed.success) return { error: "Invalid listing." }

  try {
    const supabase = await createClient()
    const catalog = pnlCatalogClient(supabase)
    const shop = await requireHaydenShopUserId(catalog)
    if ("error" in shop) return shop
    const listings = await listHaydenShopListingsForPnl(catalog, shop.userId)
    const listing = listings.find((l) => l.listing_id === parsed.data.listingId)
    if (!listing) {
      return { error: "Listing not found on Hayden's shop." }
    }

    const attached = await listAttachedListingIds(supabase)
    if (attached.has(listing.listing_id)) {
      return { error: "This board is already on the balance sheet." }
    }

    if (listing.order_id) {
      const attachedOrders = await listAttachedOrderIds(supabase)
      if (attachedOrders.has(listing.order_id)) {
        return { error: "This sale is already on the balance sheet." }
      }
    }

    const values = haydenShopListingToPnlInsert(listing, staff.userId)
    if (!values) {
      return { error: "Only active and sold Hayden shop listings can be attached." }
    }

    const data = await insertPnlEntry(supabase, values)
    return { data }
  } catch {
    return { error: "Could not attach this listing." }
  }
}

export async function attachHaydenShopActiveAndSoldService(): Promise<
  { data: PnlEntryRow[]; skipped: number } | ServiceError
> {
  const staff = await requireStaffUserId()
  if ("error" in staff) return staff
  try {
    const supabase = await createClient()
    const catalog = pnlCatalogClient(supabase)
    const shop = await requireHaydenShopUserId(catalog)
    if ("error" in shop) return shop
    return attachHaydenShopActiveAndSoldListings(catalog, {
      shopUserId: shop.userId,
      createdBy: staff.userId,
    })
  } catch {
    return { error: "Could not attach Hayden's shop listings." }
  }
}

export async function attachReswellOrderService(
  raw: unknown,
): Promise<{ data: PnlEntryRow } | ServiceError> {
  const staff = await requireStaffUserId()
  if ("error" in staff) return staff

  const parsed = attachReswellOrderSchema.safeParse(raw)
  if (!parsed.success) return { error: "Invalid order." }

  try {
    const supabase = await createClient()
    const orders = await listReswellOrdersForUser(supabase, staff.userId)
    const order = orders.find((o) => o.order_id === parsed.data.orderId)
    if (!order) {
      return { error: "Order not found or not one of yours." }
    }

    const attached = await listAttachedOrderIds(supabase)
    if (attached.has(order.order_id)) {
      return { error: "This order is already on the balance sheet." }
    }

    const orderDate = order.order_date.slice(0, 10)
    const base = {
      board_name: order.board_name,
      category: null,
      other_costs: 0,
      notes: null,
      order_id: order.order_id,
      listing_id: order.listing_id,
      order_role: order.role,
      order_num: order.order_num,
      listing_slug: order.listing_slug,
      created_by: staff.userId,
    }

    const values: PnlEntryInsert =
      order.role === "seller"
        ? {
            ...base,
            status: "sold",
            source_kind: "outside",
            bought_from: null,
            purchase_price: 0,
            purchase_date: null,
            asking_price: order.item_price,
            sale_price: order.item_price,
            sale_date: orderDate,
            shipping_cost: 0,
            platform_fee: order.platform_fee,
          }
        : {
            ...base,
            status: "inventory",
            source_kind: "reswell",
            bought_from: "Reswell",
            purchase_price: order.item_price,
            purchase_date: orderDate,
            asking_price: null,
            sale_price: null,
            sale_date: null,
            shipping_cost: order.shipping_amount,
            platform_fee: 0,
          }

    const data = await insertPnlEntry(supabase, values)
    return { data }
  } catch {
    return { error: "Could not attach this order." }
  }
}

export async function deletePnlEntryService(raw: unknown): Promise<{ success: true } | ServiceError> {
  const staff = await requireStaffUserId()
  if ("error" in staff) return staff

  const parsed = deletePnlEntrySchema.safeParse(raw)
  if (!parsed.success) {
    return { error: "Invalid entry id." }
  }

  try {
    const supabase = await createClient()
    await deletePnlEntryRow(supabase, parsed.data.id)
    return { success: true }
  } catch {
    return { error: "Could not delete this board." }
  }
}
