import { z } from "zod"

/** Stable `/api/mobile/v1` shapes. Add fields freely. Renames and removals wait for v2. */

export const mobileMeSchema = z.object({
  id: z.string().uuid(),
  email: z.string().nullable(),
  display_name: z.string(),
  seller_slug: z.string().nullable(),
  avatar_url: z.string().nullable(),
})

export const mobileListingCardSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().nullable(),
  title: z.string(),
  brand: z.string().nullable(),
  model: z.string().nullable(),
  condition: z.string().nullable(),
  condition_label: z.string().nullable(),
  section: z.string(),
  board_type: z.string().nullable(),
  dimensions: z.string().nullable(),
  price_usd: z.number(),
  price_cents: z.number().int(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  shipping_available: z.boolean(),
  local_pickup: z.boolean(),
  image_url: z.string().nullable(),
  price_label: z.string(),
  condition_line: z.string().nullable(),
  shipping_label: z.string().nullable(),
  pickup_label: z.string().nullable(),
})

export const mobileListingDetailSchema = mobileListingCardSchema.extend({
  status: z.string(),
  description: z.string().nullable(),
  image_urls: z.array(z.string()),
  seller: z.object({
    name: z.string(),
    seller_slug: z.string().nullable(),
  }),
  /** Present when the request includes a signed-in session. */
  favorited: z.boolean().optional(),
  in_cart: z.boolean().optional(),
})

export const mobileListingsPageSchema = z.object({
  listings: z.array(mobileListingCardSchema),
  limit: z.number().int(),
  offset: z.number().int(),
  has_more: z.boolean(),
})

/**
 * Homepage sections, in the same order the website renders them.
 * The site decides membership and sort. The app only lays these out.
 */
export const mobileHomeBrandSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  logo_url: z.string().nullable(),
})

export const mobileHomeShopSchema = z.object({
  id: z.string().uuid(),
  seller_slug: z.string().nullable(),
  name: z.string(),
  avatar_url: z.string().nullable(),
  location_label: z.string().nullable(),
  verified: z.boolean(),
})

export const mobileHomeListingsSectionSchema = z.object({
  kind: z.literal("listings"),
  id: z.enum([
    "recently_listed",
    "recently_added_fins",
    "recently_added_surfboards",
    "recently_sold",
    "reswell_shop",
  ]),
  title: z.string(),
  listings: z.array(mobileListingCardSchema).min(1),
})

export const mobileHomeBrandsSectionSchema = z.object({
  kind: z.literal("brands"),
  id: z.literal("trending_brands"),
  title: z.string(),
  brands: z.array(mobileHomeBrandSchema).min(1),
})

export const mobileHomeShopsSectionSchema = z.object({
  kind: z.literal("shops"),
  id: z.literal("featured_shops"),
  title: z.string(),
  shops: z.array(mobileHomeShopSchema).min(1),
})

export const mobileHomeSectionSchema = z.discriminatedUnion("kind", [
  mobileHomeListingsSectionSchema,
  mobileHomeBrandsSectionSchema,
  mobileHomeShopsSectionSchema,
])

export const mobileHomeSchema = z.object({
  sections: z.array(mobileHomeSectionSchema),
})

/** Signed-in history from `user_recently_viewed_listings`, newest view first. */
export const mobileRecentlyViewedSchema = z.object({
  listings: z.array(mobileListingCardSchema),
})

/** Peer catalog sections. Same slugs as the website category routes. */
export const MOBILE_LISTING_CATEGORIES = [
  "surfboards",
  "fins",
  "traction",
  "wetsuits",
  "apparel",
  "magazines",
  "boardbags",
  "surfpacks",
  "leashes",
  "accessories",
] as const

/** Surfboard shapes. Same slugs as `/boards?type=`. */
export const MOBILE_BOARD_TYPES = [
  "shortboard",
  "groveler",
  "fish",
  "asym",
  "hybrid",
  "longboard",
  "step-up-gun",
  "other",
] as const

export type MobileListingCategory = (typeof MOBILE_LISTING_CATEGORIES)[number]
export type MobileBoardType = (typeof MOBILE_BOARD_TYPES)[number]

export const MOBILE_CATEGORY_SORTS = ["relevant", "newest", "price-low", "price-high"] as const

export const mobileCategorySortSchema = z.object({
  id: z.enum(MOBILE_CATEGORY_SORTS),
  label: z.string(),
})

export const mobileCategoryFacetOptionSchema = z.object({
  value: z.string(),
  label: z.string(),
})

export const mobileCategoryFacetSchema = z.object({
  id: z.string(),
  label: z.string(),
  options: z.array(mobileCategoryFacetOptionSchema).min(1),
})

/** Website category page: atmosphere photo plus the facet groups that page already uses. */
export const mobileCategorySchema = z.object({
  slug: z.enum(MOBILE_LISTING_CATEGORIES),
  title: z.string(),
  image_url: z.string().nullable(),
  image_position: z.string().nullable(),
  ship: z.boolean(),
  sorts: z.array(mobileCategorySortSchema).min(1),
  facets: z.array(mobileCategoryFacetSchema),
})

export const mobileCategoryListingsQuerySchema = z.object({
  offset: z.coerce.number().int().min(0).max(5000).default(0),
  sort: z.enum(MOBILE_CATEGORY_SORTS).default("relevant"),
  shipping: z.literal("1").optional(),
  type: z.enum(MOBILE_BOARD_TYPES).optional(),
  style: z.string().trim().max(200).optional(),
  condition: z.string().trim().max(200).optional(),
  fin: z.string().trim().max(200).optional(),
  finSystem: z.string().trim().max(200).optional(),
  construction: z.string().trim().max(200).optional(),
  length: z.string().trim().max(200).optional(),
  volume: z.string().trim().max(200).optional(),
  size: z.string().trim().max(200).optional(),
  kind: z.string().trim().max(200).optional(),
})

export type MobileBrowseChip = {
  label: string
  category: MobileListingCategory
  board_type?: MobileBoardType
}

/**
 * Website browse order: surfboards, then shapes, then the rest of the category rail.
 * A shape chip also sets `category` to surfboards.
 */
export const MOBILE_BROWSE_CHIPS: readonly MobileBrowseChip[] = [
  { label: "Surfboards", category: "surfboards" },
  { label: "Shortboard", category: "surfboards", board_type: "shortboard" },
  { label: "Groveler", category: "surfboards", board_type: "groveler" },
  { label: "Fish", category: "surfboards", board_type: "fish" },
  { label: "Asym", category: "surfboards", board_type: "asym" },
  { label: "Hybrid", category: "surfboards", board_type: "hybrid" },
  { label: "Longboard", category: "surfboards", board_type: "longboard" },
  { label: "Step-Up / Gun", category: "surfboards", board_type: "step-up-gun" },
  { label: "Other", category: "surfboards", board_type: "other" },
  { label: "Fins", category: "fins" },
  { label: "Traction", category: "traction" },
  { label: "Wetsuits", category: "wetsuits" },
  { label: "Apparel", category: "apparel" },
  { label: "Magazines", category: "magazines" },
  { label: "Boardbags", category: "boardbags" },
  { label: "Surfpacks", category: "surfpacks" },
  { label: "Leashes", category: "leashes" },
  { label: "Accessories", category: "accessories" },
]

const mobileListingsQueryObject = z.object({
  limit: z.coerce.number().int().min(1).max(40).default(20),
  offset: z.coerce.number().int().min(0).max(5000).default(0),
  q: z.string().trim().max(80).optional(),
  /** Kept for existing clients. `category` is the same filter. */
  section: z.string().trim().max(40).optional(),
  category: z.enum(MOBILE_LISTING_CATEGORIES).optional(),
  board_type: z.enum(MOBILE_BOARD_TYPES).optional(),
})

export const mobileListingsQuerySchema = mobileListingsQueryObject.superRefine((data, ctx) => {
  if (data.section && data.category && data.section !== data.category) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "category and section must match",
      path: ["category"],
    })
  }
  const category = data.category ?? data.section
  if (data.board_type && category && category !== "surfboards") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "board_type only applies to surfboards",
      path: ["board_type"],
    })
  }
})

export const mobileListingParamSchema = z.object({
  id: z.string().trim().min(1).max(200),
})

/**
 * Public storefront. Look up by `seller_slug`.
 * Private account fields stay on `GET /me`.
 */
export const mobileProfileSchema = z.object({
  id: z.string().uuid(),
  seller_slug: z.string(),
  name: z.string(),
  is_shop: z.boolean(),
  about: z.string().nullable(),
  city: z.string().nullable(),
  location_label: z.string().nullable(),
  avatar_url: z.string().nullable(),
  banner_url: z.string().nullable(),
  verified: z.boolean(),
  website_url: z.string().nullable(),
  phone: z.string().nullable(),
  sales_count: z.number().int().nonnegative(),
  follower_count: z.number().int().nonnegative(),
  listing_count: z.number().int().nonnegative(),
  rating_average: z.number().min(0).max(5),
  review_count: z.number().int().nonnegative(),
  member_since: z.string(),
  member_since_label: z.string(),
  /** Present when the request includes a signed-in session. */
  following: z.boolean().optional(),
})

export const mobileProfileParamSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
})

export const mobileApiErrorSchema = z.object({
  error: z.string(),
})

export type MobileMe = z.infer<typeof mobileMeSchema>
export type MobileListingCard = z.infer<typeof mobileListingCardSchema>
export type MobileListingDetail = z.infer<typeof mobileListingDetailSchema>
export type MobileListingsPage = z.infer<typeof mobileListingsPageSchema>
export type MobileHome = z.infer<typeof mobileHomeSchema>
export type MobileRecentlyViewed = z.infer<typeof mobileRecentlyViewedSchema>
export type MobileCategory = z.infer<typeof mobileCategorySchema>
export type MobileCategorySortId = (typeof MOBILE_CATEGORY_SORTS)[number]
export type MobileCategoryListingsQuery = z.infer<typeof mobileCategoryListingsQuerySchema>
export type MobileHomeSection = z.infer<typeof mobileHomeSectionSchema>
export type MobileHomeBrand = z.infer<typeof mobileHomeBrandSchema>
export type MobileHomeShop = z.infer<typeof mobileHomeShopSchema>
export type MobileListingsQuery = z.infer<typeof mobileListingsQuerySchema>
export type MobileProfile = z.infer<typeof mobileProfileSchema>

const mobilePageFields = {
  limit: z.number().int(),
  offset: z.number().int(),
  has_more: z.boolean(),
}

export const mobileProfileListingsQuerySchema = mobileListingsQueryObject.extend({
  status: z.enum(["current", "sold"]).default("current"),
})

export const mobileReviewsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(40).default(20),
  offset: z.coerce.number().int().min(0).max(500).default(0),
})

export const mobileReviewSchema = z.object({
  id: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().nullable(),
  created_at: z.string(),
  reviewer_name: z.string(),
  role: z.enum(["seller", "buyer"]),
})

export const mobileReviewsPageSchema = z.object({
  reviews: z.array(mobileReviewSchema),
  ...mobilePageFields,
})

export const mobileFavoriteSchema = z.object({
  id: z.string().uuid(),
  saved_at: z.string(),
  listing: mobileListingCardSchema,
})

export const mobileFavoritesSchema = z.object({
  favorites: z.array(mobileFavoriteSchema),
})

export const mobileFollowedSellerSchema = z.object({
  id: z.string().uuid(),
  seller_slug: z.string(),
  name: z.string(),
  avatar_url: z.string().nullable(),
  city: z.string().nullable(),
  is_shop: z.boolean(),
  verified: z.boolean(),
})

export const mobileFollowingSchema = z.object({
  sellers: z.array(mobileFollowedSellerSchema),
})

export const mobileCartItemSchema = z.object({
  quantity: z.number().int().positive(),
  listing: mobileListingCardSchema,
})

export const mobileCartSchema = z.object({
  items: z.array(mobileCartItemSchema),
  item_count: z.number().int().nonnegative(),
})

export const mobileOfferSchema = z.object({
  id: z.string().uuid(),
  status: z.string(),
  role: z.enum(["sent", "received"]),
  amount_usd: z.number(),
  amount_label: z.string(),
  expires_at: z.string(),
  note: z.string().nullable(),
  listing_id: z.string().uuid(),
  listing_title: z.string(),
  listing_image_url: z.string().nullable(),
  counterparty_name: z.string(),
})

export const mobileOffersSchema = z.object({
  offers: z.array(mobileOfferSchema),
})

export const mobileOrderSchema = z.object({
  id: z.string().uuid(),
  order_number: z.string(),
  status: z.string(),
  status_label: z.string(),
  delivery_status: z.string().nullable(),
  amount_usd: z.number(),
  amount_label: z.string(),
  fulfillment_label: z.string(),
  created_at: z.string(),
  tracking_number: z.string().nullable(),
  listing_id: z.string().uuid().nullable(),
  listing_title: z.string(),
  listing_image_url: z.string().nullable(),
  counterparty_name: z.string(),
})

export const mobileOrdersSchema = z.object({
  orders: z.array(mobileOrderSchema),
})

export const mobileSaleSchema = mobileOrderSchema.extend({
  seller_earnings_usd: z.number(),
  seller_earnings_label: z.string(),
})

export const mobileSalesSchema = z.object({
  sales: z.array(mobileSaleSchema),
})

export const mobileConversationPreviewSchema = z.object({
  id: z.string().uuid(),
  listing_id: z.string().uuid().nullable(),
  listing_title: z.string().nullable(),
  other_name: z.string(),
  other_avatar_url: z.string().nullable(),
  preview: z.string().nullable(),
  last_message_at: z.string(),
  unread_count: z.number().int().nonnegative(),
})

export const mobileConversationsSchema = z.object({
  conversations: z.array(mobileConversationPreviewSchema),
})

export const mobileMessageSchema = z.object({
  id: z.string().uuid(),
  body: z.string(),
  created_at: z.string(),
  mine: z.boolean(),
})

export const mobileConversationDetailSchema = z.object({
  id: z.string().uuid(),
  listing_id: z.string().uuid().nullable(),
  listing_title: z.string().nullable(),
  other_name: z.string(),
  messages: z.array(mobileMessageSchema),
})

export const mobileConversationParamSchema = z.object({
  id: z.string().uuid(),
})

export const mobileFavoriteBodySchema = z.object({
  listing_id: z.string().uuid(),
  favorited: z.boolean(),
})

export const mobileFavoriteResultSchema = z.object({
  favorited: z.boolean(),
})

export const mobileFollowBodySchema = z.object({
  seller_id: z.string().uuid(),
  following: z.boolean(),
})

export const mobileFollowResultSchema = z.object({
  following: z.boolean(),
  follower_count: z.number().int().nonnegative(),
})

export const mobileCartBodySchema = z.object({
  listing_id: z.string().uuid(),
  quantity: z.number().int().min(0).max(99).default(1),
})

export const mobileCartResultSchema = z.object({
  in_cart: z.boolean(),
  quantity: z.number().int().nonnegative(),
})

export const mobileMessageBodySchema = z.object({
  body: z.string().trim().min(1).max(4000),
})

export const mobileMessageResultSchema = z.object({
  id: z.string().uuid(),
  conversation_id: z.string().uuid(),
  body: z.string(),
  created_at: z.string(),
})

export const mobileOfferActionBodySchema = z
  .object({
    action: z.enum(["accept", "decline", "counter", "withdraw"]),
    counter_amount: z.number().positive().optional(),
    counter_note: z.string().trim().max(200).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.action === "counter" && (data.counter_amount == null || !Number.isFinite(data.counter_amount))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter a counter amount.",
        path: ["counter_amount"],
      })
    }
  })

export const mobileOfferActionResultSchema = z.object({
  offer_id: z.string().uuid(),
  removed: z.boolean(),
})

export type MobileFavoriteBody = z.infer<typeof mobileFavoriteBodySchema>
export type MobileFollowBody = z.infer<typeof mobileFollowBodySchema>
export type MobileCartBody = z.infer<typeof mobileCartBodySchema>
export type MobileMessageBody = z.infer<typeof mobileMessageBodySchema>
export type MobileMessageResult = z.infer<typeof mobileMessageResultSchema>
export type MobileOfferActionBody = z.infer<typeof mobileOfferActionBodySchema>
export type MobileOfferActionResult = z.infer<typeof mobileOfferActionResultSchema>
export type MobileFavoriteResult = z.infer<typeof mobileFavoriteResultSchema>
export type MobileFollowResult = z.infer<typeof mobileFollowResultSchema>
export type MobileCartResult = z.infer<typeof mobileCartResultSchema>

export type MobileReview = z.infer<typeof mobileReviewSchema>
export type MobileReviewsPage = z.infer<typeof mobileReviewsPageSchema>
export type MobileFavorite = z.infer<typeof mobileFavoriteSchema>
export type MobileFollowing = z.infer<typeof mobileFollowingSchema>
export type MobileCart = z.infer<typeof mobileCartSchema>
export type MobileOffer = z.infer<typeof mobileOfferSchema>
export type MobileOrder = z.infer<typeof mobileOrderSchema>
export type MobileSale = z.infer<typeof mobileSaleSchema>
export type MobileConversationPreview = z.infer<typeof mobileConversationPreviewSchema>
export type MobileConversationDetail = z.infer<typeof mobileConversationDetailSchema>
