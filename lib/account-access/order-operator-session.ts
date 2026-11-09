import type { SupabaseClient } from "@supabase/supabase-js"
import {
  marketplaceOrderParticipantRole,
  sellerIdsForOrderWork,
  type OrderOperator,
} from "@/lib/account-access/order-operator"
import { getShopAccountContext } from "@/lib/services/accountAccess"

export async function loadOrderOperator(): Promise<
  { ok: true; operator: OrderOperator } | { ok: false; status: 401; error: string }
> {
  const shop = await getShopAccountContext()
  if (!shop) return { ok: false, status: 401, error: "Unauthorized" }
  const canWriteOrders = shop.permissions.has("orders.write")
  return {
    ok: true,
    operator: {
      actorUserId: shop.actorUserId,
      operatingSellerId: shop.accountId,
      canWriteOrders,
      sellerIds: sellerIdsForOrderWork({
        actorUserId: shop.actorUserId,
        operatingAccountId: shop.accountId,
        canWriteOrders,
      }),
    },
  }
}

export async function resolveOperableOrderSellerId(
  supabase: SupabaseClient,
  orderId: string,
): Promise<{ ok: true; sellerId: string } | { ok: false; status: number; error: string }> {
  const operating = await loadOrderOperator()
  if (!operating.ok) return operating

  const { data, error } = await supabase
    .from("orders")
    .select("seller_id")
    .eq("id", orderId)
    .in("seller_id", operating.operator.sellerIds)
    .maybeSingle()

  const sellerId = typeof data?.seller_id === "string" ? data.seller_id : ""
  if (error || !sellerId) {
    return { ok: false, status: 404, error: "Order not found" }
  }
  return { ok: true, sellerId }
}

export async function loadMarketplaceOrderAccess(
  supabase: SupabaseClient,
  orderId: string,
): Promise<
  | { ok: true; role: "buyer" | "seller"; buyerId: string; sellerId: string; actorUserId: string }
  | { ok: false; status: number; error: string }
> {
  const operating = await loadOrderOperator()
  if (!operating.ok) return operating

  const { data, error } = await supabase
    .from("orders")
    .select("buyer_id, seller_id")
    .eq("id", orderId)
    .maybeSingle()

  const buyerId = typeof data?.buyer_id === "string" ? data.buyer_id : ""
  const sellerId = typeof data?.seller_id === "string" ? data.seller_id : ""
  if (error || !sellerId) {
    return { ok: false, status: 404, error: "Order not found" }
  }

  const role = marketplaceOrderParticipantRole({
    buyerId,
    sellerId,
    actorUserId: operating.operator.actorUserId,
    operatingSellerId: operating.operator.operatingSellerId,
    canWriteOrders: operating.operator.canWriteOrders,
  })
  if (!role) return { ok: false, status: 404, error: "Order not found" }
  return { ok: true, role, buyerId, sellerId, actorUserId: operating.operator.actorUserId }
}
