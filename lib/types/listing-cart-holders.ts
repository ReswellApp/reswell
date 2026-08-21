export type ListingCartHolder = {
  buyerUserId: string
  displayName: string
  avatarUrl: string | null
  addedAt: string
  openOfferId: string | null
  conversationId: string | null
}

export type ListingCartOfferProspect = {
  id: string
  title: string
  cartCount: number
}
