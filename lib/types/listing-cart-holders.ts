export type ListingCartHolder = {
  buyerUserId: string
  displayName: string
  avatarUrl: string | null
  addedAt: string
  openOfferId: string | null
  /** True when the open offer was sent by the seller and can be updated or revoked. */
  openOfferSellerInitiated: boolean
  conversationId: string | null
}

/** Admin PDP bar — who currently has this listing in cart (includes email). */
export type ListingAdminCartHolder = {
  userId: string
  displayName: string
  email: string | null
  avatarUrl: string | null
  quantity: number
  addedAt: string
}

export type ListingCartOfferProspect = {
  id: string
  title: string
  cartCount: number
  price: number
}
