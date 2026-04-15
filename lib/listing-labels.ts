/**
 * Human-readable labels for listing condition, category, and board type.
 * Stored `listings.condition` values stay `new` | `like_new` | `good` | `fair`; UI shows New / Excellent / Good / Fair.
 */

/**
 * Safe display name for a seller on listings. Uses only display_name; never exposes email.
 * Use everywhere we show seller name on public listing/seller cards.
 */
export function getPublicSellerDisplayName(profile: { display_name?: string | null } | null | undefined): string {
  const name = profile?.display_name
  if (name != null && typeof name === "string" && name.trim() !== "") return name.trim()
  return "Anonymous Seller"
}

/** Capitalize the first letter of each word for listing titles and other display text. */
export function capitalizeWords(text: string | null | undefined): string {
  if (!text || typeof text !== "string") return ""
  return text.trim().replace(/\b\w/g, (c) => c.toUpperCase())
}

/** Short labels for tiles, filters, chips, and `formatCondition`. */
export const LISTING_CONDITION_LABELS: Record<string, string> = {
  new: "New",
  like_new: "Excellent",
  good: "Good",
  fair: "Fair",
}

export function formatCondition(condition: string | null | undefined): string {
  if (!condition) return ""
  return (
    LISTING_CONDITION_LABELS[condition] ?? condition.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  )
}

/** Sell-form dropdown rows (value is persisted to `listings.condition`). */
export const LISTING_CONDITION_SELL_OPTIONS: { value: string; label: string }[] = [
  { value: "new", label: "New — never used" },
  { value: "like_new", label: "Excellent — minimal wear" },
  { value: "good", label: "Good — normal wear" },
  { value: "fair", label: "Fair — visible wear, still functional" },
]

const LISTING_CONDITION_ORDER = ["new", "like_new", "good", "fair"] as const

/** Rows for browse filters (values only; pair with `{ value: \"all\", label: \"Any Condition\" }`). */
export function listingConditionFilterRows(): { value: string; label: string }[] {
  return LISTING_CONDITION_ORDER.map((v) => ({
    value: v,
    label: LISTING_CONDITION_LABELS[v],
  }))
}

/** Map legacy DB / canonical names to preferred display labels (URLs & slugs unchanged). */
const CATEGORY_DISPLAY_OVERRIDES: Record<string, string> = {
  "collectibles & vintage": "Vintage",
}

export function formatCategory(name: string | null | undefined): string {
  if (!name) return ""
  const override = CATEGORY_DISPLAY_OVERRIDES[name.trim().toLowerCase()]
  if (override) return override
  return name.replace(/\b\w/g, (c) => c.toUpperCase())
}

const BOARD_TYPE_LABELS: Record<string, string> = {
  shortboard: "Shortboard",
  longboard: "Longboard",
  hybrid: "Hybrid",
  funboard: "Hybrid",
  "step-up-gun": "Step-Up / Gun",
  "step-up": "Step-Up / Gun",
  groveler: "Groveler",
  gun: "Step-Up / Gun",
  other: "Other",
}

export function formatBoardType(boardType: string | null | undefined): string {
  if (!boardType) return ""
  const raw = boardType.trim()
  if (!raw) return ""
  const key =
    raw === "fish"
      ? "groveler"
      : raw === "funboard"
        ? "hybrid"
        : raw === "step-up" || raw === "gun"
          ? "step-up-gun"
          : raw
  return BOARD_TYPE_LABELS[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * Text for the small category pill on listing tiles.
 * For surfboards, `listings.board_type` is canonical (browse filters + admin category updates keep it in sync with `category_id`).
 * Prefer it over embedded `categories.name`, which can lag or disagree after category moves.
 */
export function formatListingTileCategoryPillText(listing: {
  section: string
  board_type?: string | null
  categories?: { name?: string | null } | null | { name?: string | null }[]
}): string | null {
  const cat = listing.categories
  const row = Array.isArray(cat) ? cat?.[0] : cat

  if (listing.section === "surfboards") {
    if (listing.board_type?.trim()) {
      return formatBoardType(listing.board_type)
    }
    if (row?.name?.trim()) return formatCategory(row.name)
    return null
  }

  if (row?.name?.trim()) return formatCategory(row.name)
  return null
}
