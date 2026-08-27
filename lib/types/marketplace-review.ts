export type MarketplaceReviewPhotoRef = {
  fileName: string
}

export type ExistingMarketplaceReview = {
  id: string
  rating: number
  comment: string | null
  created_at: string
  photos: MarketplaceReviewPhotoRef[]
}
