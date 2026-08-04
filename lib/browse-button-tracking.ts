/**
 * Browse page button click tracking vocabulary.
 * Categories match category browse URL slugs (/boards, /wetsuits, …).
 */

export const BROWSE_BUTTON_CATEGORIES = [
  "boards",
  "wetsuits",
  "apparel",
  "fins",
  "leashes",
  "boardbags",
  "surfpacks",
  "accessories",
  "magazines",
] as const

export type BrowseButtonCategory = (typeof BROWSE_BUTTON_CATEGORIES)[number]

export const BROWSE_BUTTON_KEYS = ["ship_to_me", "filter", "facet"] as const

export type BrowseButtonKey = (typeof BROWSE_BUTTON_KEYS)[number]

export const BROWSE_BUTTON_CATEGORY_LABELS: Record<BrowseButtonCategory, string> = {
  boards: "Boards",
  wetsuits: "Wetsuits",
  apparel: "Apparel",
  fins: "Fins",
  leashes: "Leashes",
  boardbags: "Boardbags",
  surfpacks: "Surfpacks",
  accessories: "Accessories",
  magazines: "Magazines",
}

export const BROWSE_BUTTON_LABELS: Record<BrowseButtonKey, string> = {
  ship_to_me: "Ship to me",
  filter: "Filter",
  facet: "Facet filter",
}

/** Human labels for facet URL param keys shown in admin. */
export const BROWSE_FACET_KEY_LABELS: Record<string, string> = {
  style: "Board style",
  length: "Length",
  volume: "Volume",
  fin: "Fin setup",
  finSystem: "Fin system",
  construction: "Construction",
  condition: "Condition",
  size: "Size",
  kind: "Category",
  brand: "Brand",
  model: "Model",
  price: "Price",
  year: "Year",
  location: "Location",
  radius: "Radius",
  shipping: "Shipping available",
}

export function browseFacetKeyLabel(key: string): string {
  return BROWSE_FACET_KEY_LABELS[key] ?? key
}
