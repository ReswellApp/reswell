export interface SellerFollow {
  id: string
  follower_id: string
  seller_id: string
  created_at: string
}

export interface FollowStatus {
  following: boolean
  followerCount: number
}

export interface FollowedSeller {
  id: string
  display_name: string | null
  shop_name: string | null
  avatar_url: string | null
  shop_logo_url: string | null
  city: string | null
  shop_address: string | null
  follower_count: number
  listing_count: number
  last_listed_at: string | null
  followed_at: string
}

export interface FollowNotification {
  id: string
  user_id: string
  type: 'new_listing_from_followed' | 'price_drop_from_followed'
  listing_id: string | null
  actor_id: string | null
  message: string | null
  is_read: boolean
  created_at: string
  actor?: {
    display_name: string | null
    shop_name: string | null
    avatar_url: string | null
    city: string | null
  }
  listing?: {
    id: string
    title: string
    price: number
    slug: string | null
    section: string
    listing_images?: { url: string; is_primary: boolean }[]
  }
}

export interface NotificationPreferences {
  follow_in_app: boolean
  follow_email_digest: boolean
  digest_time: 'morning' | 'evening'
}

export interface FeedListing {
  id: string
  title: string
  price: number
  slug: string | null
  section: string
  created_at: string
  city: string | null
  state: string | null
  listing_images?: { url: string; is_primary: boolean }[]
  seller: {
    id: string
    display_name: string | null
    shop_name: string | null
    avatar_url: string | null
    city: string | null
  }
}
