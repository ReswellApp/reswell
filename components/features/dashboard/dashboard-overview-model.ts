export interface DashboardOverviewListingPreview {
  id: string
  title: string
  price: number
  section: string | null
  imageSrc: string | null
  href: string
}

export interface DashboardOverviewModel {
  name: string
  location: string | null
  profileImageUrl: string | null
  shopHref: string | null
  walletBalance: number
  lifetimeEarned: number
  activeListings: number
  listingCount: number
  sellerOrderCount: number
  buyerOrderCount: number
  pendingOffers: number
  unreadCount: number
  unreadSupportCount: number
  favoriteCount: number
  followerCount: number
  followingCount: number
  newFollowersThisMonth: number
  isAdmin: boolean
  activeListingPreviews: DashboardOverviewListingPreview[]
  draftListingPreviews: DashboardOverviewListingPreview[]
}
