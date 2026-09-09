import type { ListingImageForCard } from "@/lib/listing-image-display"

export type HowToSellPhotoExample = {
  listingId: string
  href: string
  title: string
  condition: string | null
  images: string[]
  listingImages: ListingImageForCard[]
}

export type HowToSellReviewPreview = {
  id: string
  rating: number
  comment: string
  reviewerName: string
  createdAtLabel: string
}

export type HowToSellShopSpotlight = {
  id: string
  name: string
  href: string
  avatarSrc: string
  location: string | null
  verified: boolean
  salesCount: number
  avgRating: number
  reviewCount: number
  reviews: HowToSellReviewPreview[]
}

export type HowToSellGuidePayload = {
  photoExamples: HowToSellPhotoExample[]
  shops: HowToSellShopSpotlight[]
}
