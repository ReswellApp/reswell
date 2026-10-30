import type { Href } from "expo-router"

const ORDER_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Native shipping-label viewer for a marketplace sale. */
export function saleLabelHref(orderId: string | null | undefined): Href | null {
  const id = orderId?.trim() ?? ""
  if (!ORDER_ID_RE.test(id)) return null
  return { pathname: "/account/sales/[id]/label", params: { id } }
}
