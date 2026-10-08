import { fetchDropoffLocationById } from "@/lib/db/dropoff-locations"
import { getDropoffLocationGrantByUserId } from "@/lib/db/dropoff-location-grants"
import { listDropoffShippingOrders, orderListingDropoffIds } from "@/lib/db/dropoff-location-orders"
import { formatOrderNumForCustomer } from "@/lib/order-num-display"
import { authorizeDropoffLocationView, orderBelongsToDropoffLocation } from "@/lib/services/dropoffLocationAccess"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"

export type DropoffLocationDashboardOrder = {
  id: string
  orderNumber: string
  title: string
  sellerName: string | null
  statusLabel: string
  deliveryLabel: string
  trackingNumber: string | null
  trackingCarrier: string | null
  createdLabel: string
  hasLabel: boolean
  waiting: boolean
}

export type DropoffLocationDashboardData = {
  location: {
    name: string
    addressLine: string
    hoursNote: string | null
    phone: string | null
  }
  waitingCount: number
  orders: DropoffLocationDashboardOrder[]
}

const DELIVERY_LABEL: Record<string, string> = {
  pending: "Waiting to ship",
  shipped: "Shipped",
  delivered: "Delivered",
  pickup_ready: "Ready for pickup",
  picked_up: "Picked up",
}

function formatAddress(parts: {
  address_line1: string
  address_line2: string | null
  city: string
  state: string
  postal_code: string
}): string {
  const street = [parts.address_line1, parts.address_line2].map((part) => part?.trim()).filter(Boolean).join(", ")
  const city = [parts.city, parts.state].map((part) => part?.trim()).filter(Boolean).join(", ")
  return [street, [city, parts.postal_code?.trim()].filter(Boolean).join(" ")].filter(Boolean).join(" · ")
}

function formatCreated(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

export async function getDropoffLocationDashboard(): Promise<
  | { ok: true; data: DropoffLocationDashboardData }
  | { ok: false; code: "not_found" }
  | { ok: false; code: "error"; error: string }
> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const db = createServiceRoleClient()
    const grant = user ? await getDropoffLocationGrantByUserId(db, user.id) : null
    if (authorizeDropoffLocationView({ userId: user?.id ?? null, grantUserId: grant?.userId ?? null }) !== "allow") {
      return { ok: false, code: "not_found" }
    }
    if (!grant) return { ok: false, code: "not_found" }

    const location = await fetchDropoffLocationById(db, grant.dropoffLocationId)
    if (!location) return { ok: false, code: "not_found" }

    const orders = await listDropoffShippingOrders(db, location.id)
    const mapped = orders.map((order) => ({
      id: order.id,
      orderNumber: formatOrderNumForCustomer(order.orderNum, order.id),
      title: order.title,
      sellerName: order.sellerName,
      statusLabel: order.status === "refunding" ? "Refunding" : "Confirmed",
      deliveryLabel: DELIVERY_LABEL[order.deliveryStatus ?? ""] ?? (order.deliveryStatus || "Open"),
      trackingNumber: order.trackingNumber?.trim() || null,
      trackingCarrier: order.trackingCarrier?.trim() || null,
      createdLabel: formatCreated(order.createdAt),
      hasLabel: order.hasLabel,
      waiting: order.deliveryStatus === "pending",
    }))

    return {
      ok: true,
      data: {
        location: {
          name: location.name,
          addressLine: formatAddress(location),
          hoursNote: location.hours_note?.trim() || null,
          phone: location.phone?.trim() || null,
        },
        waitingCount: mapped.filter((order) => order.waiting).length,
        orders: mapped,
      },
    }
  } catch (error) {
    console.error("[dropoff location dashboard]", error)
    return { ok: false, code: "error", error: "Could not load the dropoff dashboard." }
  }
}

export async function authorizeDropoffLocationLabelDownload(orderId: string): Promise<
  | { ok: true; orderId: string; orderNum: string | null; trackingNumber: string | null }
  | { ok: false; status: 401 | 404 | 500 }
> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { ok: false, status: 401 }

    const db = createServiceRoleClient()
    const grant = await getDropoffLocationGrantByUserId(db, user.id)
    if (authorizeDropoffLocationView({ userId: user.id, grantUserId: grant?.userId ?? null }) !== "allow" || !grant) {
      return { ok: false, status: 404 }
    }

    const dropoffIds = await orderListingDropoffIds(db, orderId)
    if (
      !orderBelongsToDropoffLocation({
        locationId: grant.dropoffLocationId,
        listingDropoffIds: dropoffIds,
      })
    ) {
      return { ok: false, status: 404 }
    }

    const { data: order, error } = await db
      .from("orders")
      .select("id, order_num, tracking_number, status, fulfillment_method, is_admin_test")
      .eq("id", orderId)
      .maybeSingle()
    if (error) throw error
    if (!order) return { ok: false, status: 404 }

    const row = order as {
      id: string
      order_num: string | null
      tracking_number: string | null
      status: string | null
      fulfillment_method: string | null
      is_admin_test: boolean | null
    }
    if (
      row.is_admin_test === true ||
      row.fulfillment_method !== "shipping" ||
      (row.status !== "confirmed" && row.status !== "refunding")
    ) {
      return { ok: false, status: 404 }
    }
    return {
      ok: true,
      orderId: row.id,
      orderNum: row.order_num,
      trackingNumber: typeof row.tracking_number === "string" ? row.tracking_number : null,
    }
  } catch (error) {
    console.error("[dropoff location label]", { orderId, error })
    return { ok: false, status: 500 }
  }
}
