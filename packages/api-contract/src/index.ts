import { z } from "zod"

/** Stable `/api/mobile/v1` shapes. Add fields freely. Renames and removals wait for v2. */

export const mobileProfileAddressSchema = z.object({
  id: z.string().uuid(),
  label: z.string().nullable(),
  full_name: z.string(),
  line: z.string(),
  is_default: z.boolean(),
})

/** Same profile settings the website dashboard edits. */
export const mobileProfileSettingsSchema = z.object({
  display_name: z.string(),
  seller_slug: z.string().nullable(),
  email: z.string().nullable(),
  avatar_url: z.string().nullable(),
  bio: z.string().nullable(),
  location: z.string().nullable(),
  city: z.string().nullable(),
  shop_banner_url: z.string().nullable(),
  shop_tile_banner_url: z.string().nullable(),
  signed_in_with: z.enum(["google", "email"]),
  /** True when this account has an email-and-password login, same check as the website. */
  has_email_password: z.boolean(),
  message_sms_opt_in: z.boolean(),
  sms_phone: z.string().nullable(),
  addresses: z.array(mobileProfileAddressSchema),
})

export const mobileProfileSettingsPatchSchema = z.object({
  display_name: z.string().trim().min(5).max(50),
  bio: z.string().trim().max(2000).optional(),
  location: z.string().trim().max(160).optional(),
  city: z.string().trim().max(80).optional(),
  message_sms_opt_in: z.boolean().optional(),
})

export const mobileProfileAvatarResultSchema = z.object({
  avatar_url: z.string().nullable(),
})

export const mobileProfileBannerResultSchema = z.object({
  banner_url: z.string().nullable(),
})

export const mobileProfilePasswordSchema = z.object({
  current_password: z.string().min(1, "Current password is incorrect.").max(72),
  new_password: z.string().min(6, "Password must be at least 6 characters.").max(72),
})

export const mobileProfileEmailSchema = z.object({
  email: z.string().trim().email().max(320),
})

export const mobileProfileSignInActionSchema = z.object({
  ok: z.literal(true),
})

export const mobileMeSchema = z.object({
  id: z.string().uuid(),
  email: z.string().nullable(),
  display_name: z.string(),
  seller_slug: z.string().nullable(),
  avatar_url: z.string().nullable(),
})

/** Seller row on feed cards and other listing tiles. Detail adds review fields on the same base. */
export const mobileListingCardSellerSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  seller_slug: z.string().nullable(),
  avatar_url: z.string().nullable(),
  verified: z.boolean(),
  /** Present when the request includes a signed-in session. */
  following: z.boolean().optional(),
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
  /** Buyer-facing length × width × thickness. Same line as the website Dimensions row. */
  dimensions: z.string().nullable(),
  /** Buyer-facing liters. Same line as the website Volume row. */
  volume_label: z.string().nullable(),
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
  /** Same relative line as listing detail, e.g. `7 days ago`. */
  listed_label: z.string().nullable(),
  seller: mobileListingCardSellerSchema.nullable(),
})

/** Playable listing clip. `url` is the `/media/listing-videos` stream, not the storage object. */
export const mobileListingVideoSchema = z.object({
  id: z.string().uuid(),
  url: z.string().url(),
  poster_url: z.string().url().nullable(),
  content_type: z.string().nullable(),
  duration_seconds: z.number().nullable(),
})

export const mobileListingDetailSchema = mobileListingCardSchema.extend({
  status: z.string(),
  description: z.string().nullable(),
  image_urls: z.array(z.string()),
  /** Sort order matches `/l`. Empty when the seller did not upload a video. */
  videos: z.array(mobileListingVideoSchema),
  view_count: z.number().int().nonnegative(),
  watcher_count: z.number().int().nonnegative(),
  cart_holder_count: z.number().int().nonnegative(),
  /** Same relative line as `/l`, e.g. `15 days ago`. */
  listed_label: z.string().nullable(),
  /** City and state, same uppercase line as `/l`. */
  location_line: z.string().nullable(),
  seller: mobileListingCardSellerSchema.extend({
    location_label: z.string().nullable(),
    joined_year: z.string().nullable(),
    rating_average: z.number().min(0).max(5),
    review_count: z.number().int().nonnegative(),
  }),
  /** Present when the request includes a signed-in session. */
  favorited: z.boolean().optional(),
  in_cart: z.boolean().optional(),
  /** Directory brand page. Null when the listing brand is not in the catalog. */
  brand_slug: z.string().nullable(),
  /** Catalog model page under that brand. Null when the model is not in the catalog. */
  model_slug: z.string().nullable(),
})

export const mobileListingsPageSchema = z.object({
  listings: z.array(mobileListingCardSchema),
  limit: z.number().int(),
  offset: z.number().int(),
  has_more: z.boolean(),
})

/**
 * Marketplace feed. Same three lists as the website `/sold` page:
 * newest active surfboards, sold, and shipped boards.
 */
export const MOBILE_MARKETPLACE_FEED_TABS = ["new", "sold", "shipped"] as const

export const mobileMarketplaceFeedTabSchema = z.enum(MOBILE_MARKETPLACE_FEED_TABS)

export const mobileMarketplaceFeedCursorSchema = z.object({
  sold_at: z.string(),
  listing_id: z.string().uuid(),
})

export const mobileMarketplaceFeedQuerySchema = z
  .object({
    tab: mobileMarketplaceFeedTabSchema.default("new"),
    page: z.coerce.number().int().min(1).max(500).default(1),
    sold_at: z.string().trim().min(1).max(64).optional(),
    listing_id: z.string().uuid().optional(),
  })
  .superRefine((data, ctx) => {
    const hasCursor = Boolean(data.sold_at) || Boolean(data.listing_id)
    if (Boolean(data.sold_at) !== Boolean(data.listing_id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A complete sold cursor is required",
        path: ["sold_at"],
      })
    }
    if (hasCursor && data.tab !== "sold") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A sold cursor only applies to the sold feed",
        path: ["tab"],
      })
    }
    if (data.tab === "sold" && data.page > 1 && !hasCursor) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Further sold pages use the cursor from the previous page",
        path: ["page"],
      })
    }
  })

export const mobileMarketplaceFeedStatsSchema = z.object({
  count: z.number().int().nonnegative(),
  gmv_label: z.string().nullable(),
  caption: z.string(),
})

export const mobileMarketplaceFeedSchema = z.object({
  tab: mobileMarketplaceFeedTabSchema,
  title: z.string(),
  subtitle: z.string(),
  listings: z.array(mobileListingCardSchema),
  page: z.number().int(),
  page_size: z.number().int(),
  has_more: z.boolean(),
  next_cursor: mobileMarketplaceFeedCursorSchema.nullable(),
  stats: mobileMarketplaceFeedStatsSchema.nullable(),
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

const mobileCatalogSlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/i)

export const mobileBrandParamSchema = z.object({
  slug: mobileCatalogSlugSchema,
})

export const mobileModelParamSchema = mobileBrandParamSchema.extend({
  model: mobileCatalogSlugSchema,
})

export const mobileBrandCardSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  logo_url: z.string().nullable(),
  short_description: z.string().nullable(),
  location_label: z.string().nullable(),
  listing_count: z.number().int().nonnegative(),
  model_count: z.number().int().nonnegative(),
})

export const mobileBrandsPageSchema = z.object({
  brands: z.array(mobileBrandCardSchema),
})

export const mobileBrandModelCardSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  image_url: z.string().nullable(),
  category_label: z.string(),
})

export const mobileBrandPageSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  logo_url: z.string().nullable(),
  short_description: z.string().nullable(),
  website_url: z.string().nullable(),
  location_label: z.string().nullable(),
  founder_name: z.string().nullable(),
  lead_shaper_name: z.string().nullable(),
  models: z.array(mobileBrandModelCardSchema),
  listings: z.array(mobileListingCardSchema),
  sold_listings: z.array(mobileListingCardSchema),
  listings_capped: z.boolean(),
  sold_capped: z.boolean(),
})

export const mobileModelVariantSchema = z.object({
  id: z.string().uuid(),
  label: z.string(),
})

export const mobileModelReviewSchema = z.object({
  id: z.string().uuid(),
  rating: z.number().min(1).max(5),
  comment: z.string().nullable(),
  author_name: z.string(),
  created_label: z.string(),
})

export const mobileModelPriceGuideSchema = z.object({
  range_label: z.string(),
  sold_median_label: z.string(),
  asking_median_label: z.string(),
  sold_count: z.number().int().nonnegative(),
  confidence_label: z.string(),
  bands: z.array(
    z.object({
      condition_label: z.string(),
      typical_label: z.string(),
      comps: z.number().int().nonnegative(),
    }),
  ),
})

export const mobileModelPageSchema = z.object({
  brand_slug: z.string(),
  brand_name: z.string(),
  model_slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  category_label: z.string(),
  hero_image_url: z.string().nullable(),
  variants: z.array(mobileModelVariantSchema),
  listings: z.array(mobileListingCardSchema),
  sold_listings: z.array(mobileListingCardSchema),
  price_guide: mobileModelPriceGuideSchema.nullable(),
  review_average: z.number().min(0).max(5),
  review_count: z.number().int().nonnegative(),
  reviews: z.array(mobileModelReviewSchema),
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

/** Same mile choices as the website boards location filter. "Any distance" is omitted. */
export const MOBILE_BOARD_RADIUS = ["25", "50", "100", "200"] as const

function blankToUndefined(value: unknown): unknown {
  if (value == null) return undefined
  if (typeof value === "string" && value.trim() === "") return undefined
  return value
}

export const mobileCategoryListingsQuerySchema = z
  .object({
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
    location: z.preprocess(blankToUndefined, z.string().trim().max(120).optional()),
    lat: z.preprocess(blankToUndefined, z.coerce.number().min(-90).max(90).optional()),
    lng: z.preprocess(blankToUndefined, z.coerce.number().min(-180).max(180).optional()),
    radius: z.preprocess(blankToUndefined, z.enum(MOBILE_BOARD_RADIUS).optional()),
  })
  .superRefine((value, ctx) => {
    if ((value.lat == null) !== (value.lng == null)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Latitude and longitude are set together",
        path: ["lat"],
      })
    }
    if (value.radius && value.lat == null && !value.location) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A radius needs a place",
        path: ["radius"],
      })
    }
  })

export type MobileCategoryChip = {
  label: string
  category: MobileListingCategory
}

/** Category rail chip. Shapes are not on this row. */
export type MobileBrowseChip = MobileCategoryChip

export type MobileBoardStyleFilter = {
  label: string
  board_type: MobileBoardType
}

/**
 * Offline fallback for the category rail. The live strip comes from
 * `/api/mobile/v1/browse-rail`, which reads the website header list.
 * Surfboards, Fins, Traction, Wetsuits, Boardbags, Surfpacks, Leashes, Apparel, Magazines.
 */
export const MOBILE_CATEGORY_CHIPS: readonly MobileCategoryChip[] = [
  { label: "Surfboards", category: "surfboards" },
  { label: "Fins", category: "fins" },
  { label: "Traction", category: "traction" },
  { label: "Wetsuits", category: "wetsuits" },
  { label: "Boardbags", category: "boardbags" },
  { label: "Surfpacks", category: "surfpacks" },
  { label: "Leashes", category: "leashes" },
  { label: "Apparel", category: "apparel" },
  { label: "Magazines", category: "magazines" },
]

/** Seller resource screens. Same pages as the website dropdown. */
export const MOBILE_SELLER_RESOURCE_SLUGS = [
  "for-surf-shops",
  "how-to-sell",
  "how-to-ship",
  "sales-map",
  "seller-resources",
] as const

export type MobileSellerResourceSlug = (typeof MOBILE_SELLER_RESOURCE_SLUGS)[number]

/** A page on the live site. `screen` opens the native seller resource. `category` opens a catalog. */
export const mobileBrowseLinkSchema = z.object({
  label: z.string(),
  href: z.string(),
  category: z.enum(MOBILE_LISTING_CATEGORIES).nullable(),
  screen: z.enum(MOBILE_SELLER_RESOURCE_SLUGS).nullable(),
})

const mobileSellerResourceCardSchema = z.object({
  title: z.string(),
  body: z.string(),
  screen: z.enum(MOBILE_SELLER_RESOURCE_SLUGS).nullable(),
  listing_id: z.string().nullable(),
  image_url: z.string().nullable(),
})

export const mobileSellerResourceSectionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("paragraphs"),
    title: z.string().nullable(),
    paragraphs: z.array(z.string()).min(1),
  }),
  z.object({
    kind: z.literal("steps"),
    title: z.string().nullable(),
    steps: z.array(z.object({ title: z.string(), body: z.string() })).min(1),
  }),
  z.object({
    kind: z.literal("cards"),
    title: z.string().nullable(),
    cards: z.array(mobileSellerResourceCardSchema).min(1),
  }),
  z.object({
    kind: z.literal("faqs"),
    title: z.string().nullable(),
    items: z.array(z.object({ question: z.string(), answer: z.string() })).min(1),
  }),
])

/** Body of a seller resource page. The website and the app both read this. */
export const mobileSellerResourceSchema = z.object({
  slug: z.enum(MOBILE_SELLER_RESOURCE_SLUGS),
  title: z.string(),
  description: z.string(),
  sections: z.array(mobileSellerResourceSectionSchema),
})

export type MobileSellerResource = z.infer<typeof mobileSellerResourceSchema>

/**
 * Homepage slider. Categories match the website rail. Menus match a website dropdown,
 * including Seller Resources. The app fetches this on each visit.
 */
export const MOBILE_BROWSE_PAGES = ["sellers", "sold"] as const

export const mobileBrowseRailItemSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("category"),
    label: z.string(),
    href: z.string(),
    category: z.enum(MOBILE_LISTING_CATEGORIES).nullable(),
  }),
  z.object({
    kind: z.literal("menu"),
    id: z.string(),
    label: z.string(),
    items: z.array(mobileBrowseLinkSchema).min(1),
  }),
  z.object({
    kind: z.literal("page"),
    label: z.string(),
    href: z.string(),
    page: z.enum(MOBILE_BROWSE_PAGES).nullable(),
  }),
])

export const mobileBrowseRailSchema = z.object({
  items: z.array(mobileBrowseRailItemSchema).min(1),
})

export type MobileBrowseRail = z.infer<typeof mobileBrowseRailSchema>
export type MobileBrowseRailItem = z.infer<typeof mobileBrowseRailItemSchema>

/**
 * Sell-flow categories. Same slugs as marketplace browse.
 * Subcategories are the identity filters for that category — board style for surfboards.
 */
export const mobileSellSubcategorySchema = z.object({
  slug: z.string().min(1),
  label: z.string().min(1),
})

/** Same cost choices as the website sell radios. */
export const MOBILE_SELL_SHIPPING_MODES = ["reswell", "free", "flat"] as const

export const mobileSellShippingOptionSchema = z.object({
  id: z.enum(MOBILE_SELL_SHIPPING_MODES),
  label: z.string().min(1),
  detail: z.string().min(1),
  badge: z.string().min(1).nullable(),
})

/**
 * Shipping section for one sell category. Mirrors that category's website `/sell` flow.
 * Shipping starts on. Local pickup starts off, and is omitted when the category ships only.
 */
export const mobileSellFulfillmentSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  hint: z.string().min(1).nullable(),
  shipping_default: z.literal(true),
  /** Seller can turn shipping off. Ship-only categories keep it on. */
  shipping_toggle: z.boolean(),
  shipping_label: z.string().min(1),
  shipping_badge: z.string().min(1).nullable(),
  /** Shown when shipping is on and there is no cost-mode choice (apparel, magazines). */
  shipping_detail: z.string().min(1).nullable(),
  /** Heading for the compact Shipping / Local pickup choices. Null when the category ships only. */
  delivery_title: z.string().min(1).nullable(),
  /** Heading above the Reswell / free / flat choices. */
  cost_title: z.string().min(1).nullable(),
  local_pickup: z.boolean(),
  local_pickup_default: z.literal(false),
  /** Empty when the category always uses Reswell calculated shipping. */
  shipping_options: z.array(mobileSellShippingOptionSchema),
  package_dimensions: z.boolean(),
  /** Surfboards can be dropped at a city Reswell packs and ships from. */
  dropoff: z.boolean(),
})

export const mobileSellCategorySchema = z.object({
  slug: z.enum(MOBILE_LISTING_CATEGORIES),
  label: z.string().min(1),
  /** Null when this category has no subcategory. "Board style" for surfboards. */
  subcategory_label: z.string().min(1).nullable(),
  subcategories: z.array(mobileSellSubcategorySchema),
  fulfillment: mobileSellFulfillmentSchema,
  /** True when this category uses the surfboard dimensions and fins section on the photos step. */
  board_specs: z.boolean(),
})

export const mobileSellTaxonomySchema = z.object({
  categories: z.array(mobileSellCategorySchema).min(1),
})

export type MobileSellTaxonomy = z.infer<typeof mobileSellTaxonomySchema>
export type MobileSellCategory = z.infer<typeof mobileSellCategorySchema>
export type MobileSellFulfillment = z.infer<typeof mobileSellFulfillmentSchema>
export type MobileSellShippingMode = (typeof MOBILE_SELL_SHIPPING_MODES)[number]

export const mobileSellSpecOptionSchema = z.object({
  value: z.string(),
  label: z.string().min(1),
  /** Alternate label when the seller switches width and thickness to decimals. */
  decimal_label: z.string().min(1).nullable(),
})

export const mobileSellSpecFieldSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  hint: z.string().min(1).nullable(),
  required: z.boolean(),
  kind: z.enum(["select", "text"]),
  placeholder: z.string().nullable(),
  suffix: z.string().min(1).nullable(),
  options: z.array(mobileSellSpecOptionSchema),
  /**
   * Option value to center in the picker when nothing is selected yet.
   * Matches website `BOARD_*_FOCUS_VALUE` for length / width / thickness.
   */
  focus_value: z.string().min(1).nullable(),
})

export const mobileSellSpecSectionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).nullable(),
  hint: z.string().min(1).nullable(),
  fields: z.array(mobileSellSpecFieldSchema).min(1),
})

/** Surfboard dimensions, fins, and construction. Same options as the website photos step. */
export const mobileSellBoardSpecsSchema = z.object({
  sections: z.array(mobileSellSpecSectionSchema).min(1),
})

export type MobileSellBoardSpecs = z.infer<typeof mobileSellBoardSpecsSchema>
export type MobileSellSpecField = z.infer<typeof mobileSellSpecFieldSchema>

export const mobileSellDropoffPackageSchema = z.object({
  length: z.string().min(1),
  width: z.string().min(1),
  height: z.string().min(1),
  weight_lb: z.string().min(1),
  weight_oz: z.string().min(1),
})

export const mobileSellDropoffLocationSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  city: z.string().min(1),
  state: z.string().min(1),
  /** True when this board's length and width fit a box this city packs. */
  available: z.boolean(),
  detail: z.string().min(1),
  /** Packed box to store when the seller chooses this city. Null until the board fits. */
  package: mobileSellDropoffPackageSchema.nullable(),
})

export const mobileSellDropoffLocationsSchema = z.object({
  locations: z.array(mobileSellDropoffLocationSchema),
})

export type MobileSellDropoffLocations = z.infer<typeof mobileSellDropoffLocationsSchema>

export const mobileSellPhotoSchema = z.object({
  url: z.string().url(),
  thumbnail_url: z.string().url(),
})

export const mobileSellPublishSchema = z
  .object({
    title: z.string().trim().min(1).max(160),
    description: z.string().trim().min(1).max(8000),
    brand: z.string().trim().min(1).max(80),
    model: z.string().trim().min(1).max(80),
    category: z.enum(MOBILE_LISTING_CATEGORIES),
    subcategory: z.string().trim().max(40),
    condition: z.enum(["brand_new", "excellent", "very_good", "good", "fair", "poor"]),
    price: z.number().positive().max(999_999.99),
    city: z.string().trim().min(1).max(80),
    state: z.string().trim().min(1).max(40),
    location_lat: z.number().gte(-90).lte(90),
    location_lng: z.number().gte(-180).lte(180),
    local_pickup: z.boolean(),
    shipping: z.boolean(),
    shipping_mode: z.enum(["reswell", "free", "flat"]),
    shipping_price: z.number().min(0).max(9999).nullable(),
    package_length: z.string().max(12),
    package_width: z.string().max(12),
    package_height: z.string().max(12),
    package_weight_lb: z.string().max(12),
    package_weight_oz: z.string().max(12),
    dropoff_location_id: z.string().uuid().nullable(),
    specs: z.object({
      length: z.string().max(20).optional(),
      width: z.string().max(20).optional(),
      thickness: z.string().max(20).optional(),
      volume: z.string().max(20).optional(),
      fin_setup: z.string().max(40).optional(),
      fin_system: z.string().max(40).optional(),
      fins_included: z.string().max(40).optional(),
      construction: z.string().max(40).optional(),
    }),
    images: z.array(mobileSellPhotoSchema).min(1).max(8),
    draft_id: z.string().uuid().nullable(),
  })
  .refine((value) => value.shipping || value.local_pickup, {
    message: "Choose shipping or local pickup",
  })
  .refine((value) => value.category !== "surfboards" || value.subcategory.length > 0, {
    message: "Choose a board style",
  })

/** Incomplete sell form. Saved as a hidden website draft, not a live listing. */
export const mobileSellDraftSchema = z.object({
  id: z.string().uuid().nullable(),
  title: z.string().trim().max(160),
  description: z.string().trim().max(8000),
  brand: z.string().trim().max(80),
  model: z.string().trim().max(80),
  category: z.enum(MOBILE_LISTING_CATEGORIES),
  subcategory: z.string().trim().max(40),
  condition: z.enum(["brand_new", "excellent", "very_good", "good", "fair", "poor", ""]),
  price: z.number().min(0).max(999_999.99).nullable(),
  city: z.string().trim().max(80),
  state: z.string().trim().max(40),
  location_lat: z.number().gte(-90).lte(90).nullable(),
  location_lng: z.number().gte(-180).lte(180).nullable(),
  local_pickup: z.boolean(),
  shipping: z.boolean(),
  shipping_mode: z.enum(["reswell", "free", "flat"]),
  package_length: z.string().max(12),
  package_width: z.string().max(12),
  package_height: z.string().max(12),
  package_weight_lb: z.string().max(12),
  package_weight_oz: z.string().max(12),
  shipping_price: z.number().min(0).max(9999).nullable(),
  dropoff_location_id: z.string().uuid().nullable(),
  specs: z.object({
    length: z.string().max(20).optional(),
    width: z.string().max(20).optional(),
    thickness: z.string().max(20).optional(),
    volume: z.string().max(20).optional(),
    fin_setup: z.string().max(40).optional(),
    fin_system: z.string().max(40).optional(),
    fins_included: z.string().max(40).optional(),
    construction: z.string().max(40).optional(),
  }),
  images: z.array(mobileSellPhotoSchema).max(8),
})

export const mobileSellPublishResultSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1),
})

export type MobileSellPublish = z.infer<typeof mobileSellPublishSchema>
export type MobileSellPublishResult = z.infer<typeof mobileSellPublishResultSchema>
export type MobileSellDraft = z.infer<typeof mobileSellDraftSchema>
export type MobileSellPhoto = z.infer<typeof mobileSellPhotoSchema>

/** Google place dropdown for the sell location field. `place_id` is set when Google returned the row. */
export const mobilePlaceSuggestionSchema = z.object({
  label: z.string().min(1),
  place_id: z.string().min(1).nullable(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  city: z.string(),
  state: z.string(),
})

export const mobilePlaceSuggestionsSchema = z.object({
  suggestions: z.array(mobilePlaceSuggestionSchema),
})

export const mobilePlaceSuggestQuerySchema = z.object({
  q: z.string().trim().min(2).max(200),
})

export const mobilePlaceDetailsQuerySchema = z.object({
  place_id: z.string().trim().min(1).max(300),
})

export const mobilePlaceDetailsSchema = z.object({
  label: z.string().min(1),
  place_id: z.string().min(1),
  lat: z.number(),
  lng: z.number(),
  city: z.string().min(1),
  state: z.string().min(1),
})

export type MobilePlaceSuggestion = z.infer<typeof mobilePlaceSuggestionSchema>
export type MobilePlaceSuggestions = z.infer<typeof mobilePlaceSuggestionsSchema>
export type MobilePlaceDetails = z.infer<typeof mobilePlaceDetailsSchema>

/** Categories the sell catalog search can return. Same set as the website `/sell` search. */
export const MOBILE_SELL_CATALOG_CATEGORIES = ["surfboards", "fins", "wetsuits", "apparel"] as const

export const mobileSellCatalogQuerySchema = z.object({
  q: z.string().trim().min(1).max(200),
})

export const mobileSellCatalogRowSchema = z.object({
  kind: z.enum(["brand", "model", "variant"]),
  id: z.string().min(1),
  brand_id: z.string().min(1),
  brand_name: z.string().min(1),
  model_name: z.string().nullable(),
  category: z.enum(MOBILE_SELL_CATALOG_CATEGORIES),
  category_label: z.string().min(1),
  board_type: z.enum(MOBILE_BOARD_TYPES).nullable(),
  image_url: z.string().nullable(),
  title: z.string().min(1),
})

export const mobileSellCatalogSearchSchema = z.object({
  results: z.array(mobileSellCatalogRowSchema),
})

export type MobileSellCatalogRow = z.infer<typeof mobileSellCatalogRowSchema>
export type MobileSellCatalogSearch = z.infer<typeof mobileSellCatalogSearchSchema>

/**
 * Surfboard shape filters. Same slugs and labels as the website board-style facet
 * (`BOARD_STYLE_OPTIONS` / `/boards?type=`).
 */
export const MOBILE_BOARD_STYLE_FILTERS: readonly MobileBoardStyleFilter[] = [
  { label: "Shortboard", board_type: "shortboard" },
  { label: "Groveler", board_type: "groveler" },
  { label: "Fish", board_type: "fish" },
  { label: "Asym", board_type: "asym" },
  { label: "Hybrid / Mid-Length", board_type: "hybrid" },
  { label: "Longboard", board_type: "longboard" },
  { label: "Step-Up / Gun", board_type: "step-up-gun" },
  { label: "Other", board_type: "other" },
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
 * Horizontal rails under `/l`. Titles, membership, and order come from the server
 * so a sort or query change on the website shows up in the app without a release.
 * Unknown future fields are ignored by older clients that only read these keys.
 */
export const mobileListingRailSectionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  listings: z.array(mobileListingCardSchema).min(1),
})

export const mobileListingRailsSchema = z.object({
  sections: z.array(mobileListingRailSectionSchema),
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
  /** Crop focal when `banner_url` is set. Matches website `shop_banner_focal_*`. */
  banner_focal_x: z.number().min(0).max(100),
  banner_focal_y: z.number().min(0).max(100),
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
  /** Present when the signed-in viewer is this seller (their following list is private). */
  following_count: z.number().int().nonnegative().optional(),
})

/** `/sellers` directory. Order, copy, and lines come from the same catalog as the website. */
export const mobileSellerCardSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1),
  name: z.string(),
  verified: z.boolean(),
  avatar_url: z.string().nullable(),
  image_urls: z.array(z.string()).max(3),
  lines: z.array(z.string()).max(6),
})

export const mobileSellersQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
})

export const mobileSellersPageSchema = z.object({
  title: z.string(),
  description: z.string(),
  search_placeholder: z.string(),
  summary: z.string().nullable(),
  empty_title: z.string(),
  empty_body: z.string(),
  sellers: z.array(mobileSellerCardSchema),
})

/** `/sellers/[slug]`. Profile facts plus the current inventory the website shows. */
export const mobileSellerPageSchema = z.object({
  profile: mobileProfileSchema,
  listings: z.array(mobileListingCardSchema),
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

export type MobileProfileSettings = z.infer<typeof mobileProfileSettingsSchema>
export type MobileProfileSettingsPatch = z.infer<typeof mobileProfileSettingsPatchSchema>
export type MobileProfileAvatarResult = z.infer<typeof mobileProfileAvatarResultSchema>
export type MobileProfileBannerResult = z.infer<typeof mobileProfileBannerResultSchema>
export type MobileProfilePassword = z.infer<typeof mobileProfilePasswordSchema>
export type MobileProfileEmail = z.infer<typeof mobileProfileEmailSchema>
export type MobileProfileSignInAction = z.infer<typeof mobileProfileSignInActionSchema>
export type MobileMe = z.infer<typeof mobileMeSchema>
export type MobileListingCardSeller = z.infer<typeof mobileListingCardSellerSchema>
export type MobileListingCard = z.infer<typeof mobileListingCardSchema>
export type MobileListingVideo = z.infer<typeof mobileListingVideoSchema>
export type MobileListingDetail = z.infer<typeof mobileListingDetailSchema>
export type MobileListingRailSection = z.infer<typeof mobileListingRailSectionSchema>
export type MobileListingRails = z.infer<typeof mobileListingRailsSchema>
export type MobileListingsPage = z.infer<typeof mobileListingsPageSchema>
export type MobileMarketplaceFeedTab = z.infer<typeof mobileMarketplaceFeedTabSchema>
export type MobileMarketplaceFeedQuery = z.infer<typeof mobileMarketplaceFeedQuerySchema>
export type MobileMarketplaceFeed = z.infer<typeof mobileMarketplaceFeedSchema>
export type MobileMarketplaceFeedStats = z.infer<typeof mobileMarketplaceFeedStatsSchema>
export type MobileHome = z.infer<typeof mobileHomeSchema>
export type MobileBrandCard = z.infer<typeof mobileBrandCardSchema>
export type MobileBrandsPage = z.infer<typeof mobileBrandsPageSchema>
export type MobileBrandPage = z.infer<typeof mobileBrandPageSchema>
export type MobileModelPage = z.infer<typeof mobileModelPageSchema>
export type MobileRecentlyViewed = z.infer<typeof mobileRecentlyViewedSchema>
export type MobileCategory = z.infer<typeof mobileCategorySchema>
export type MobileCategorySortId = (typeof MOBILE_CATEGORY_SORTS)[number]
export type MobileCategoryListingsQuery = z.infer<typeof mobileCategoryListingsQuerySchema>
export type MobileHomeSection = z.infer<typeof mobileHomeSectionSchema>
export type MobileHomeBrand = z.infer<typeof mobileHomeBrandSchema>
export type MobileHomeShop = z.infer<typeof mobileHomeShopSchema>
export type MobileListingsQuery = z.infer<typeof mobileListingsQuerySchema>

export const mobileSearchQuerySchema = z.object({
  q: z.string().trim().min(2).max(80),
})

export const mobileSearchSchema = z.object({
  listings: z.array(mobileListingCardSchema),
})

export const mobileSearchResultsSchema = z.object({
  query: z.string(),
  listings: z.array(mobileListingCardSchema),
  browse: z
    .object({
      category: z.enum(MOBILE_LISTING_CATEGORIES),
      board_type: z.enum(MOBILE_BOARD_TYPES).nullable(),
    })
    .nullable(),
  /** Model, brand, and length the website prints under the results heading. */
  summary: z
    .object({
      model: z.string().nullable(),
      brand: z.string().nullable(),
      length: z.string().nullable(),
    })
    .nullable(),
})

export const mobileSavedSearchQuerySchema = mobileSearchQuerySchema

export const mobileSavedSearchBodySchema = z.object({
  q: z.string().trim().min(2).max(80),
  saved: z.boolean(),
})

export const mobileSavedSearchSchema = z.object({
  saved_search_id: z.string().uuid().nullable(),
})

export type MobileSearchQuery = z.infer<typeof mobileSearchQuerySchema>
export type MobileSearch = z.infer<typeof mobileSearchSchema>
export type MobileSearchResults = z.infer<typeof mobileSearchResultsSchema>
export type MobileSavedSearch = z.infer<typeof mobileSavedSearchSchema>
export type MobileSavedSearchBody = z.infer<typeof mobileSavedSearchBodySchema>

/** Copy from the website save-search card. `compact` is the phone size. */
export function savedSearchCardCopy(input: { saved: boolean; compact: boolean; noun: string }): {
  title: string
  body: string
  button: string
} {
  const matching = input.compact ? `a new matching ${input.noun}` : `a matching ${input.noun}`
  return {
    title: "Let the Gear Come to You",
    body: input.saved
      ? `This search is saved. We'll email you when ${matching} is listed on Reswell.`
      : `Save this search and we'll email you when ${matching} is listed on Reswell.`,
    button: input.saved ? "Saved" : "Save Search",
  }
}
export type MobileSellerCard = z.infer<typeof mobileSellerCardSchema>
export type MobileSellersPage = z.infer<typeof mobileSellersPageSchema>
export type MobileSellerPage = z.infer<typeof mobileSellerPageSchema>
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

export const mobileFollowersSchema = mobileFollowingSchema

/** Same destinations as the website dashboard sidebar, already filtered for this account. */
export const MOBILE_DASHBOARD_PAGE_IDS = [
  "overview",
  "shipper",
  "profile",
  "earnings",
  "balance-sheet",
  "listings",
  "shopify",
  "offers",
  "messages",
  "support",
  "purchases",
  "sales",
  "favorites",
  "following",
  "seller-profile",
] as const

export const mobileDashboardPageSchema = z.object({
  id: z.enum(MOBILE_DASHBOARD_PAGE_IDS),
  label: z.string().min(1),
})

/**
 * Signed-in seller home. Counts and earnings match the website dashboard.
 * `pages` is the account menu: only the sections this user is allowed to open.
 */
export const mobileDashboardSchema = z.object({
  id: z.string().uuid(),
  email: z.string().nullable(),
  display_name: z.string(),
  seller_slug: z.string().nullable(),
  avatar_url: z.string().nullable(),
  about: z.string().nullable(),
  website_url: z.string().nullable(),
  follower_count: z.number().int().nonnegative(),
  following_count: z.number().int().nonnegative(),
  review_count: z.number().int().nonnegative(),
  rating_average: z.number().min(0).max(5),
  active_listing_count: z.number().int().nonnegative(),
  sold_count: z.number().int().nonnegative(),
  purchase_count: z.number().int().nonnegative(),
  favorite_count: z.number().int().nonnegative(),
  pending_offer_count: z.number().int().nonnegative(),
  unread_message_count: z.number().int().nonnegative(),
  earnings_lifetime_usd: z.number().nonnegative(),
  earnings_lifetime_label: z.string(),
  wallet_balance_usd: z.number().nonnegative(),
  wallet_balance_label: z.string(),
  pages: z.array(mobileDashboardPageSchema),
})

export const mobileEarningsActivitySchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  status_label: z.string().min(1),
  amount_usd: z.number(),
  amount_label: z.string(),
  created_at: z.string(),
})

/** Wallet the seller can cash out, plus pending sales and recent ledger rows. */
export const mobileEarningsSchema = z.object({
  available_usd: z.number().nonnegative(),
  available_label: z.string(),
  ready_usd: z.number().nonnegative(),
  ready_label: z.string(),
  pending_usd: z.number().nonnegative(),
  pending_label: z.string(),
  cashed_out_usd: z.number().nonnegative(),
  cashed_out_label: z.string(),
  earned_last_30d_usd: z.number().nonnegative(),
  earned_last_30d_label: z.string(),
  payout_label: z.string(),
  payout_detail: z.string(),
  cash_out_ready: z.boolean(),
  minimum_usd: z.number().positive(),
  instant_fee_rate: z.number().nonnegative(),
  banks: z.array(
    z.object({
      id: z.string().regex(/^ba_/),
      label: z.string().min(1),
      default: z.boolean(),
    }),
  ),
  activity: z.array(mobileEarningsActivitySchema),
})

export type MobileEarnings = z.infer<typeof mobileEarningsSchema>

export const mobileCashOutBodySchema = z.object({
  amount: z.coerce.number().finite().min(10, "Minimum payout amount is $10.00"),
  speed: z.enum(["standard", "instant"]).default("standard"),
  externalAccountId: z
    .string()
    .trim()
    .regex(/^ba_/)
    .optional(),
})

export const mobileCashOutResultSchema = z.object({
  message: z.string(),
  amount_label: z.string(),
  available_label: z.string(),
})

export type MobileCashOutResult = z.infer<typeof mobileCashOutResultSchema>

export const mobilePayoutOnboardingSchema = z.object({
  url: z.string().url(),
})

export const mobileSupportCaseSchema = z.object({
  id: z.string().uuid(),
  status: z.string(),
  status_label: z.string(),
  subject: z.string(),
  preview: z.string(),
  order_ref: z.string().nullable(),
  updated_at: z.string(),
  unread_count: z.number().int().nonnegative(),
  closed: z.boolean(),
})

export const mobileSupportCasesSchema = z.object({
  cases: z.array(mobileSupportCaseSchema),
})

export const mobileSupportCreateBodySchema = z.object({
  subject: z.string().trim().min(3).max(120),
  body: z.string().trim().min(10).max(4000),
})

export const mobileSupportCreateResultSchema = z.object({
  id: z.string().uuid(),
})

export const mobileSupportMessageSchema = z.object({
  id: z.string().uuid(),
  body: z.string(),
  created_at: z.string(),
  mine: z.boolean(),
  author_role: z.enum(["customer", "agent", "system"]),
})

export const mobileSupportThreadSchema = z.object({
  id: z.string().uuid(),
  subject: z.string(),
  status_label: z.string(),
  closed: z.boolean(),
  messages: z.array(mobileSupportMessageSchema),
})

export const mobileSupportReplyBodySchema = z.object({
  body: z.string().trim().min(1).max(4000),
})

export const mobileSupportReplyResultSchema = z.object({
  case_id: z.string().uuid(),
})

export const MOBILE_SHIPPER_STATUSES = ["waiting_for_run", "picked_up", "dropped_off", "cancelled"] as const

export const mobileShipperJobSchema = z.object({
  id: z.string().min(1),
  listing_title: z.string(),
  sale_label: z.string(),
  status: z.enum(MOBILE_SHIPPER_STATUSES),
  status_label: z.string(),
  pickup_label: z.string(),
  dropoff_label: z.string(),
  next_handoff: z.string(),
  actions: z.array(z.object({ status: z.enum(MOBILE_SHIPPER_STATUSES), label: z.string() })),
})

export const mobileShipperSchema = z.object({
  shipper_id: z.string().uuid(),
  display_name: z.string(),
  week_label: z.string(),
  schedule_enabled: z.boolean(),
  price_label: z.string(),
  job_count: z.number().int().nonnegative(),
  run_count: z.number().int().nonnegative(),
  jobs: z.array(mobileShipperJobSchema),
})

export const mobileShipperActionBodySchema = z
  .object({
    action: z.enum(["schedule", "job"]),
    enabled: z.boolean().optional(),
    job_id: z.string().min(1).optional(),
    status: z.enum(MOBILE_SHIPPER_STATUSES).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.action === "schedule" && typeof data.enabled !== "boolean") {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Choose on or off.", path: ["enabled"] })
    }
    if (data.action === "job" && (!data.job_id || !data.status)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Choose a board and a status.", path: ["job_id"] })
    }
  })

export const mobileShipperActionResultSchema = z.object({
  updated: z.boolean(),
})

export const mobileBalanceSheetEntrySchema = z.object({
  id: z.string().min(1),
  listing_id: z.string().uuid(),
  title: z.string(),
  section_label: z.string(),
  sold_label: z.string(),
  profit_label: z.string().nullable(),
  sold_at: z.string(),
  order_number: z.string().nullable(),
})

export const mobileBalanceSheetSchema = z.object({
  inventory_listings: z.number().int().nonnegative(),
  inventory_asking_label: z.string(),
  inventory_cost_label: z.string(),
  realized_sales: z.number().int().nonnegative(),
  gross_sales_label: z.string(),
  fees_label: z.string(),
  realized_profit_label: z.string(),
  missing_cost_basis: z.number().int().nonnegative(),
  entries: z.array(mobileBalanceSheetEntrySchema),
  page: z.number().int().positive(),
  total_pages: z.number().int().positive(),
})

export const mobileShopifySectionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
})

export const mobileShopifyProductSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  image_url: z.string().nullable(),
  price_label: z.string().nullable(),
  selected: z.boolean(),
  section_label: z.string().nullable(),
})

export const mobileShopifySchema = z.object({
  shop_name: z.string().nullable(),
  shop_domain: z.string().nullable(),
  connected: z.boolean(),
  sync_enabled: z.boolean(),
  status_label: z.string(),
  message: z.string().nullable(),
  products: z.array(mobileShopifyProductSchema),
  sections: z.array(mobileShopifySectionSchema),
})

export const mobileShopifyActionBodySchema = z.object({
  action: z.enum(["publish", "unpublish"]),
  product_id: z.string().min(1).max(300),
  section: z.string().min(1).max(40).optional(),
})

export const mobileShopifyActionResultSchema = z.object({
  product_id: z.string().min(1),
  selected: z.boolean(),
})

export const mobileCartItemSchema = z.object({
  quantity: z.number().int().positive(),
  listing: mobileListingCardSchema,
})

export const mobileCartSchema = z.object({
  items: z.array(mobileCartItemSchema),
  item_count: z.number().int().nonnegative(),
})

export const mobileCheckoutConfigSchema = z.object({
  publishable_key: z.string().min(1),
})

export const mobileCheckoutAddressSchema = z.object({
  id: z.string().uuid(),
  full_name: z.string(),
  line1: z.string(),
  line2: z.string().nullable(),
  city: z.string(),
  state: z.string().nullable(),
  postal_code: z.string(),
  country: z.string(),
  phone: z.string().nullable(),
  is_default: z.boolean(),
  label_line: z.string(),
})

export const mobileCheckoutAddressesSchema = z.object({
  addresses: z.array(mobileCheckoutAddressSchema),
})

export const mobileCheckoutAddressBodySchema = z.object({
  full_name: z.string().trim().min(1).max(120),
  line1: z.string().trim().min(1).max(160),
  line2: z.string().trim().max(160).optional(),
  city: z.string().trim().min(1).max(80),
  state: z.string().trim().max(40).optional(),
  postal_code: z.string().trim().min(3).max(20),
  country: z.string().trim().min(2).max(2).default("US"),
  phone: z.string().trim().max(30).optional(),
})

export const mobileCheckoutRateSchema = z.object({
  rate_id: z.string(),
  service_code: z.string(),
  service_name: z.string(),
  label: z.string(),
  amount_usd: z.number(),
  amount_label: z.string(),
  delivery_days: z.number().int().nullable(),
})

export const mobileCheckoutQuoteSchema = z.object({
  item_usd: z.number(),
  item_label: z.string(),
  shipping_usd: z.number(),
  shipping_label: z.string(),
  total_usd: z.number(),
  total_label: z.string(),
  quote_token: z.string().nullable(),
  rates: z.array(mobileCheckoutRateSchema),
})

export const mobileCheckoutQuoteBodySchema = z.object({
  listing_ids: z.array(z.string().uuid()).min(1).max(20),
  address_id: z.string().uuid(),
  service_code: z.string().trim().max(80).optional(),
})

export const mobileCheckoutPaymentBodySchema = z.object({
  listing_ids: z.array(z.string().uuid()).min(1).max(20),
  fulfillment: z.enum(["shipping", "pickup"]),
  address_id: z.string().uuid().optional(),
  quote_token: z.string().trim().max(4000).optional(),
})

export const mobileCheckoutPaymentSchema = z.object({
  client_secret: z.string().min(1),
  shipping_usd: z.number(),
  total_usd: z.number(),
  total_label: z.string(),
})

export const mobileCheckoutFinalizeBodySchema = z.object({
  payment_intent_id: z.string().trim().min(1).max(120),
})

export const mobileCheckoutFinalizeSchema = z.object({
  order_id: z.string().uuid(),
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

/** One seller order. The sales list stays a summary; this is the order itself. */
export const mobileSaleDetailSchema = mobileSaleSchema.extend({
  created_label: z.string(),
  buyer_paid_label: z.string(),
  shipping_label: z.string(),
  fee_label: z.string(),
  ship_to: z.string().nullable(),
  tracking_carrier: z.string().nullable(),
  payout_status: z.string().nullable(),
  conversation_id: z.string().uuid().nullable(),
  listing_slug: z.string().nullable(),
  label_available: z.boolean(),
})

export const mobileSaleLabelSchema = z.object({
  url: z.string().url(),
})

export type MobileSaleDetail = z.infer<typeof mobileSaleDetailSchema>

export const mobileMyListingSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().nullable(),
  title: z.string(),
  price_label: z.string(),
  status: z.string(),
  status_label: z.string(),
  image_url: z.string().nullable(),
  views: z.number().int().nonnegative(),
  cart_count: z.number().int().nonnegative(),
  favorite_count: z.number().int().nonnegative(),
  on_vacation: z.boolean(),
  can_vacation: z.boolean(),
  can_relist: z.boolean(),
  created_label: z.string(),
})

export const mobileMyListingsSchema = z.object({
  total_listings: z.number().int().nonnegative(),
  total_views: z.number().int().nonnegative(),
  in_carts: z.number().int().nonnegative(),
  saved: z.number().int().nonnegative(),
  listings: z.array(mobileMyListingSchema),
})

export type MobileMyListings = z.infer<typeof mobileMyListingsSchema>

export const mobileListingVacationBodySchema = z.object({
  enabled: z.boolean(),
  listing_id: z.string().uuid().optional(),
})

export const mobileListingRelistBodySchema = z.object({
  listing_id: z.string().uuid(),
})

export const mobileListingActionResultSchema = z.object({
  message: z.string(),
})

export const mobileInboxItemSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["message", "notification"]),
  title: z.string(),
  preview: z.string().nullable(),
  created_at: z.string(),
  time_label: z.string(),
  unread: z.boolean(),
  image_url: z.string().nullable(),
  bucket: z.enum(["selling", "buying", "activity"]),
  conversation_id: z.string().uuid().nullable(),
  listing_id: z.string().uuid().nullable(),
  support_case_id: z.string().uuid().nullable(),
})

export const mobileInboxSchema = z.object({
  unread_count: z.number().int().nonnegative(),
  items: z.array(mobileInboxItemSchema),
})

export type MobileInbox = z.infer<typeof mobileInboxSchema>

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

export const mobileMessageOrderSchema = z.object({
  order_id: z.string().uuid(),
  order_num: z.string(),
  total_label: z.string(),
  items: z.array(z.string()).min(1).max(8),
  payment_label: z.string(),
  fulfillment_label: z.string(),
  hint: z.string(),
})

export const mobileMessageSchema = z.object({
  id: z.string().uuid(),
  body: z.string(),
  created_at: z.string(),
  mine: z.boolean(),
  order: mobileMessageOrderSchema.nullable(),
})

export const mobileConversationDetailSchema = z.object({
  id: z.string().uuid(),
  listing_id: z.string().uuid().nullable(),
  listing_slug: z.string().nullable(),
  listing_title: z.string().nullable(),
  listing_image_url: z.string().nullable(),
  other_name: z.string(),
  other_avatar_url: z.string().nullable(),
  other_joined_label: z.string().nullable(),
  other_review_count: z.number().int().nonnegative(),
  other_rating_average: z.number().min(0).max(5).nullable(),
  viewer_is_seller: z.boolean(),
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
export type MobileFollowers = z.infer<typeof mobileFollowersSchema>
export type MobileSupportCase = z.infer<typeof mobileSupportCaseSchema>
export type MobileSupportCases = z.infer<typeof mobileSupportCasesSchema>
export type MobileSupportThread = z.infer<typeof mobileSupportThreadSchema>
export type MobileSupportReplyBody = z.infer<typeof mobileSupportReplyBodySchema>
export type MobileSupportReplyResult = z.infer<typeof mobileSupportReplyResultSchema>
export type MobileShipper = z.infer<typeof mobileShipperSchema>
export type MobileShipperActionBody = z.infer<typeof mobileShipperActionBodySchema>
export type MobileShipperActionResult = z.infer<typeof mobileShipperActionResultSchema>
export type MobileBalanceSheet = z.infer<typeof mobileBalanceSheetSchema>
export type MobileShopify = z.infer<typeof mobileShopifySchema>
export type MobileShopifyActionBody = z.infer<typeof mobileShopifyActionBodySchema>
export type MobileShopifyActionResult = z.infer<typeof mobileShopifyActionResultSchema>
export type MobileDashboardPageId = (typeof MOBILE_DASHBOARD_PAGE_IDS)[number]
export type MobileDashboardPage = z.infer<typeof mobileDashboardPageSchema>
export type MobileDashboard = z.infer<typeof mobileDashboardSchema>
export type MobileCart = z.infer<typeof mobileCartSchema>
export type MobileCheckoutConfig = z.infer<typeof mobileCheckoutConfigSchema>
export type MobileCheckoutAddress = z.infer<typeof mobileCheckoutAddressSchema>
export type MobileCheckoutAddresses = z.infer<typeof mobileCheckoutAddressesSchema>
export type MobileCheckoutQuote = z.infer<typeof mobileCheckoutQuoteSchema>
export type MobileCheckoutPayment = z.infer<typeof mobileCheckoutPaymentSchema>
export type MobileCheckoutFinalize = z.infer<typeof mobileCheckoutFinalizeSchema>
export type MobileOffer = z.infer<typeof mobileOfferSchema>
export type MobileOrder = z.infer<typeof mobileOrderSchema>
export type MobileSale = z.infer<typeof mobileSaleSchema>
export type MobileConversationPreview = z.infer<typeof mobileConversationPreviewSchema>
export type MobileMessage = z.infer<typeof mobileMessageSchema>
export type MobileConversationDetail = z.infer<typeof mobileConversationDetailSchema>
