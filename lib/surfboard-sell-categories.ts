import { boardCategoryMap } from "@/lib/utils/board-type-from-category-id"

/** Canonical surfboard shape keys for `/sell` — order matches product spec. */
export const SURFBOARD_SELL_CATEGORY_ORDER = [
  "shortboard",
  "groveler",
  "hybrid",
  "longboard",
  "step-up-gun",
  "other",
] as const

export type SurfboardSellCategoryKey = (typeof SURFBOARD_SELL_CATEGORY_ORDER)[number]

/** Display labels for the `/sell` board shape dropdown (order is {@link SURFBOARD_SELL_CATEGORY_ORDER}). */
export const SURFBOARD_SELL_CATEGORY_LABELS: Record<SurfboardSellCategoryKey, string> = {
  shortboard: "Shortboard",
  groveler: "Groveler",
  hybrid: "Hybrid",
  longboard: "Longboard",
  "step-up-gun": "Step-Up / Gun",
  other: "Other",
}

/**
 * Radix Select `value` when the seller has not chosen a shape yet (`formData.category` is "").
 * Must not collide with a category UUID.
 */
export const SELL_BOARD_CATEGORY_UNSELECTED_VALUE = "__sell_board_category_unselected__"

export const SELL_BOARD_CATEGORY_UNSELECTED_LABEL = "Choose category"

/** `public.categories.slug` for each sell key — used when category UUIDs differ from `boardCategoryMap` (e.g. seeded rows without fixed ids). */
export const SURFBOARD_SELL_CATEGORY_SLUG: Record<SurfboardSellCategoryKey, string> = {
  shortboard: "shortboard",
  groveler: "groveler",
  hybrid: "hybrid",
  longboard: "longboard",
  "step-up-gun": "step-up-gun",
  other: "other",
}

export type SellCategoryOptionRow = {
  value: string
  label: string
  board: boolean
  /** When set, used with {@link SURFBOARD_SELL_CATEGORY_SLUG} to order rows reliably. */
  slug?: string | null
}

/**
 * Surfboard-only rows for `/sell`: fixed order and labels; unknown board rows append at the end.
 */
export function orderSurfboardSellCategoryOptions(
  rows: SellCategoryOptionRow[],
): SellCategoryOptionRow[] {
  const boardRows = rows.filter((r) => r.board)
  const byId = new Map(boardRows.map((r) => [r.value.trim().toLowerCase(), r]))
  const bySlug = new Map(
    boardRows
      .filter((r) => (r.slug ?? "").trim().length > 0)
      .map((r) => [r.slug!.trim().toLowerCase(), r] as const),
  )

  const ordered: SellCategoryOptionRow[] = []
  const used = new Set<string>()

  for (const key of SURFBOARD_SELL_CATEGORY_ORDER) {
    const uuid = boardCategoryMap[key]?.trim().toLowerCase()
    const slugKey = SURFBOARD_SELL_CATEGORY_SLUG[key]?.trim().toLowerCase()
    const row =
      (uuid ? byId.get(uuid) : undefined) ??
      (slugKey ? bySlug.get(slugKey) : undefined)
    if (!row) continue
    ordered.push({
      ...row,
      label: SURFBOARD_SELL_CATEGORY_LABELS[key],
    })
    used.add(row.value.trim().toLowerCase())
  }

  const extras = boardRows
    .filter((r) => !used.has(r.value.trim().toLowerCase()))
    .sort((a, b) => a.label.localeCompare(b.label))

  return [...ordered, ...extras]
}
