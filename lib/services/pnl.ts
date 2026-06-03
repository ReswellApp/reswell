import { createClient } from "@/lib/supabase/server"
import {
  deletePnlEntryRow,
  insertPnlEntry,
  listActiveListingsForUser,
  listAttachedListingIds,
  listAttachedOrderIds,
  listPnlEntries,
  listReswellOrdersForUser,
  updatePnlEntryRow,
  type PnlEntryInsert,
  type PnlEntryRow,
  type PnlEntryUpdate,
  type ReswellListingOption,
  type ReswellOrderOption,
} from "@/lib/db/pnl"
import {
  attachReswellListingSchema,
  attachReswellOrderSchema,
  createPnlEntrySchema,
  deletePnlEntrySchema,
  updatePnlEntrySchema,
} from "@/lib/validations/pnl"
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
    return { error: "Could not load P&L entries." }
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
    purchase_price: input.purchasePrice,
    purchase_date: nullable(input.purchaseDate),
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
    return { error: "Could not create P&L entry." }
  }
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

  const values: PnlEntryUpdate = {}
  if (input.boardName !== undefined) values.board_name = input.boardName
  if (input.category !== undefined) values.category = input.category || null
  if (input.status !== undefined) values.status = input.status
  if (input.purchasePrice !== undefined) values.purchase_price = input.purchasePrice
  if (input.purchaseDate !== undefined) values.purchase_date = input.purchaseDate || null
  if (input.salePrice !== undefined) values.sale_price = input.salePrice
  if (input.saleDate !== undefined) values.sale_date = input.saleDate || null
  if (input.shippingCost !== undefined) values.shipping_cost = input.shippingCost
  if (input.platformFee !== undefined) values.platform_fee = input.platformFee
  if (input.otherCosts !== undefined) values.other_costs = input.otherCosts
  if (input.notes !== undefined) values.notes = input.notes || null

  if (Object.keys(values).length === 0) {
    return { error: "Nothing to update." }
  }

  try {
    const supabase = await createClient()
    const data = await updatePnlEntryRow(supabase, id, values)
    return { data }
  } catch {
    return { error: "Could not update P&L entry." }
  }
}

export type ReswellAttachables = {
  orders: ReswellOrderOption[]
  listings: ReswellListingOption[]
}

export async function listReswellTransactionsService(): Promise<
  { data: ReswellAttachables } | ServiceError
> {
  const staff = await requireStaffUserId()
  if ("error" in staff) return staff
  try {
    const supabase = await createClient()
    const [orders, listings, attachedOrders, attachedListings] = await Promise.all([
      listReswellOrdersForUser(supabase, staff.userId),
      listActiveListingsForUser(supabase, staff.userId),
      listAttachedOrderIds(supabase),
      listAttachedListingIds(supabase),
    ])
    return {
      data: {
        orders: orders.filter((o) => !attachedOrders.has(o.order_id)),
        listings: listings.filter((l) => !attachedListings.has(l.listing_id)),
      },
    }
  } catch {
    return { error: "Could not load your Reswell transactions." }
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
    const listings = await listActiveListingsForUser(supabase, staff.userId)
    const listing = listings.find((l) => l.listing_id === parsed.data.listingId)
    if (!listing) {
      return { error: "Active listing not found or not one of yours." }
    }

    const attached = await listAttachedListingIds(supabase)
    if (attached.has(listing.listing_id)) {
      return { error: "This board is already in your P&L." }
    }

    const values: PnlEntryInsert = {
      board_name: listing.board_name,
      category: listing.category,
      status: "listed",
      purchase_price: 0,
      purchase_date: null,
      sale_price: null,
      sale_date: null,
      shipping_cost: 0,
      platform_fee: 0,
      other_costs: 0,
      notes: null,
      order_id: null,
      listing_id: listing.listing_id,
      order_role: null,
      order_num: null,
      listing_slug: listing.listing_slug,
      created_by: staff.userId,
    }

    const data = await insertPnlEntry(supabase, values)
    return { data }
  } catch {
    return { error: "Could not attach this listing." }
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
      return { error: "This order is already in your P&L." }
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
            purchase_price: 0,
            purchase_date: null,
            sale_price: order.item_price,
            sale_date: orderDate,
            shipping_cost: 0,
            platform_fee: order.platform_fee,
          }
        : {
            ...base,
            status: "inventory",
            purchase_price: order.item_price,
            purchase_date: orderDate,
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
    return { error: "Could not delete P&L entry." }
  }
}
