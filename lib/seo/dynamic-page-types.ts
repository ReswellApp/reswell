/**
 * Dynamic page *types* — page families with thousands of instances (listings, brand profiles,
 * seller profiles) whose SEO is controlled by title/description **templates** in code.
 * Templates use `{token}` variables filled per-instance at render time.
 */

export interface DynamicTemplateVar {
  token: string
  label: string
  /** Example value used for the admin sample preview. */
  sample: string
}

export interface DynamicPageType {
  /** Stable type key (e.g. `type:listing`). */
  key: string
  label: string
  note: string
  /** Representative path used for canonical/preview hints. */
  samplePath: string
  variables: DynamicTemplateVar[]
  defaultTitleTemplate: string
  defaultDescriptionTemplate: string
}

export const DYNAMIC_PAGE_TYPES: DynamicPageType[] = [
  {
    key: "type:listing",
    label: "Listing pages",
    note: "Every individual board/gear listing at /l/[slug]. Applies to all listings.",
    samplePath: "/l/example-surfboard",
    variables: [
      { token: "title", label: "Listing title", sample: "Channel Islands Rocket 5'10\"" },
      { token: "brand", label: "Brand", sample: "Channel Islands" },
      { token: "model", label: "Model", sample: "Rocket" },
      { token: "category", label: "Category", sample: "Shortboard" },
      { token: "price", label: "Price", sample: "$499" },
      { token: "condition", label: "Condition", sample: "Good" },
      { token: "location", label: "Location", sample: "Encinitas, CA" },
    ],
    defaultTitleTemplate: "{title} · Reswell",
    defaultDescriptionTemplate:
      "{price} · {category} for sale on Reswell. {title} from a local surfer — buy with checkout, messaging, and Purchase Protection.",
  },
  {
    key: "type:brand",
    label: "Brand profiles",
    note: "Every shaper/brand page at /brands/[slug].",
    samplePath: "/brands/channel-islands",
    variables: [
      { token: "name", label: "Brand name", sample: "Channel Islands" },
      { token: "tagline", label: "Short description", sample: "Performance surfboards from Santa Barbara" },
    ],
    defaultTitleTemplate: "{name} · Surf brand — Reswell",
    defaultDescriptionTemplate:
      "Explore {name} on Reswell — models, stories, and where to find their boards.",
  },
  {
    key: "type:seller",
    label: "Seller profiles",
    note: "Every shop/seller page at /sellers/[slug].",
    samplePath: "/sellers/example-shop",
    variables: [
      { token: "name", label: "Seller / shop name", sample: "Surfside Boards" },
      { token: "location", label: "Location", sample: "Encinitas, CA" },
    ],
    defaultTitleTemplate: "{name} · Reswell",
    defaultDescriptionTemplate:
      "{name} on Reswell. Shop surf gear and boards — {location}.",
  },
]

const DYNAMIC_TYPE_BY_KEY = new Map(DYNAMIC_PAGE_TYPES.map((t) => [t.key, t]))

export function getDynamicPageType(key: string): DynamicPageType | undefined {
  return DYNAMIC_TYPE_BY_KEY.get(key)
}

export function dynamicPageTypeKeys(): string[] {
  return DYNAMIC_PAGE_TYPES.map((t) => t.key)
}
