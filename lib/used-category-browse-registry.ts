/**
 * Maps `categories.slug` (gear marketplace categories) to the browse UI preset.
 * Categories can exist in the DB before a preset exists — those use `generic`.
 * Add a preset when you introduce custom filters for that slug.
 */
export type UsedCategoryBrowsePreset =
  | "fins"
  | "wetsuits"
  | "leashes"
  | "board-bags"
  | "backpacks"
  | "apparel-lifestyle"
  | "collectibles-vintage"
  | "generic"

const PRESET_BY_SLUG: Record<string, UsedCategoryBrowsePreset> = {
  fins: "fins",
  wetsuits: "wetsuits",
  leashes: "leashes",
  "board-bags": "board-bags",
  backpacks: "backpacks",
  "apparel-lifestyle": "apparel-lifestyle",
  "collectibles-vintage": "collectibles-vintage",
}

export function browsePresetForSlug(slug: string): UsedCategoryBrowsePreset {
  return PRESET_BY_SLUG[slug] ?? "generic"
}
