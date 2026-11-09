export interface OrderOperator {
  actorUserId: string
  operatingSellerId: string
  canWriteOrders: boolean
  sellerIds: string[]
}

/**
 * Seller ids this login may operate for order work.
 * Their own sales stay available. The shop they are working in is included
 * only when that role can write orders.
 */
export function sellerIdsForOrderWork(input: {
  actorUserId: string
  operatingAccountId: string
  canWriteOrders: boolean
}): string[] {
  const ids = new Set<string>()
  const actorId = input.actorUserId.trim()
  const accountId = input.operatingAccountId.trim()
  if (actorId) ids.add(actorId)
  if (input.canWriteOrders && accountId) ids.add(accountId)
  return [...ids]
}

export function canOperateOrderAsSeller(input: {
  orderSellerId: string | null | undefined
  actorUserId: string
  operatingSellerId: string
  canWriteOrders: boolean
}): boolean {
  const sellerId = input.orderSellerId?.trim() ?? ""
  if (!sellerId) return false
  if (sellerId === input.actorUserId) return true
  return input.canWriteOrders && sellerId === input.operatingSellerId
}

export function marketplaceOrderParticipantRole(input: {
  buyerId: string | null | undefined
  sellerId: string | null | undefined
  actorUserId: string
  operatingSellerId: string
  canWriteOrders: boolean
}): "buyer" | "seller" | null {
  const buyerId = input.buyerId?.trim() ?? ""
  if (buyerId && buyerId === input.actorUserId) return "buyer"
  if (
    canOperateOrderAsSeller({
      orderSellerId: input.sellerId,
      actorUserId: input.actorUserId,
      operatingSellerId: input.operatingSellerId,
      canWriteOrders: input.canWriteOrders,
    })
  ) {
    return "seller"
  }
  return null
}

/** Seller id to use for the account this login is currently working in. */
export function activeSellerId(operator: OrderOperator): string {
  return operator.canWriteOrders ? operator.operatingSellerId : operator.actorUserId
}
