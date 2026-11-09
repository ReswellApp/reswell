import type { Href } from "expo-router"

const ORDER_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Native Track package screen for a marketplace order. */
export function trackPackageHref(orderId: string | null | undefined): Href | null {
  const id = orderId?.trim() ?? ""
  if (!ORDER_ID_RE.test(id)) return null
  return { pathname: "/track/[id]", params: { id } }
}

/** Native full-screen shipment map for a marketplace order. */
export function trackMapHref(orderId: string | null | undefined): Href | null {
  const id = orderId?.trim() ?? ""
  if (!ORDER_ID_RE.test(id)) return null
  return { pathname: "/track/[id]/map", params: { id } }
}
