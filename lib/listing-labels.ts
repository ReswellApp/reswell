/**
 * Human-readable labels for listing condition, category, and board type.
 * The sell form uses `like_new` | `good` | `fair`. Legacy rows may still have `new` (show as “New” until updated).
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
  // Legacy values (display only — no longer selectable when listing)
  new: "New",
  like_new: "Like New",
  // Current values
  brand_new: "Brand New",
  excellent: "Excellent",
  very_good: "Very Good",
  good: "Good",
  fair: "Fair",
  poor: "Poor",
}

const LISTING_CONDITION_ORDER = ["brand_new", "excellent", "very_good", "good", "fair", "poor"] as const

export function isListingSellableCondition(
  c: string | null | undefined,
): c is (typeof LISTING_CONDITION_ORDER)[number] {
  return (
    c === "brand_new" ||
    c === "excellent" ||
    c === "very_good" ||
    c === "good" ||
    c === "fair" ||
    c === "poor"
  )
}

/**
 * Load listing/draft into sell form: maps legacy condition values to the nearest
 * current equivalent so the Select always has a matching option.
 */
export function sellFormConditionValue(raw: string | null | undefined): string {
  const v = (raw ?? "").trim()
  if (v === "new") return "brand_new"
  if (v === "like_new") return "excellent"
  if (isListingSellableCondition(v)) return v
  return ""
}

export function formatCondition(condition: string | null | undefined): string {
  if (!condition) return ""
  return (
    LISTING_CONDITION_LABELS[condition] ?? condition.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  )
}

/**
 * Homepage peer listing tiles — secondary line under title (e.g. “Used — Excellent”, “Brand New”).
 */
export function formatHomePeerListingConditionLine(condition: string | null | undefined): string | null {
  const raw = typeof condition === "string" ? condition.trim() : ""
  if (!raw) return null
  const label = formatCondition(raw)
  if (!label) return null
  if (raw === "brand_new" || raw === "new") return label
  return `Used — ${label}`
}

/** Sell-form and browse filter condition values (excludes legacy `new`). */
export const LISTING_CONDITION_SELL_OPTIONS: { value: string; label: string }[] = LISTING_CONDITION_ORDER.map(
  (v) => ({ value: v, label: LISTING_CONDITION_LABELS[v] ?? v }),
)

/** Rows for browse filters (values only; pair with `{ value: \"all\", label: \"Condition Any\" }`). */
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
  fish: "Fish",
  asym: "Asym",
  gun: "Step-Up / Gun",
  other: "Other",
}

export function formatBoardType(boardType: string | null | undefined): string {
  if (!boardType) return ""
  const raw = boardType.trim()
  if (!raw) return ""
  const key =
    raw === "funboard"
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
