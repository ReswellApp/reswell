export type OrderGuestContactAddress = {
  name?: string | null
  email?: string | null
  phone?: string | null
  admin_terminal?: boolean
} | null

/** Buyer label for seller dashboards — supports terminal walk-in guests without buyer_id. */
export function resolveMarketplaceOrderBuyerLabel(input: {
  buyerId: string | null
  profileDisplayName?: string | null
  shippingAddress?: OrderGuestContactAddress
}): string {
  const profileName = input.profileDisplayName?.trim()
  if (profileName) return profileName

  const guestName = input.shippingAddress?.name?.trim()
  if (guestName) return guestName

  if (input.buyerId) {
    return `Buyer ${input.buyerId.slice(0, 8)}…`
  }

  return "Walk-in customer"
}
