/**
 * Human-readable labels for listing condition, category, and board type.
 * Use these anywhere we display badges so values like "like_new" show as "Like New".
 */

const CONDITION_LABELS: Record<string, string> = {
  new: "New",
  like_new: "Like New",
  good: "Good",
  fair: "Fair",
}

export function formatCondition(condition: string | null | undefined): string {
  if (!condition) return ""
  return CONDITION_LABELS[condition] ?? condition.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

export function formatCategory(name: string | null | undefined): string {
  if (!name) return ""
  return name.replace(/\b\w/g, (c) => c.toUpperCase())
}

const BOARD_TYPE_LABELS: Record<string, string> = {
  shortboard: "Shortboard",
  longboard: "Longboard",
  funboard: "Funboard",
  fish: "Fish",
  gun: "Gun",
  foamie: "Foamie",
  other: "Other",
}

export function formatBoardType(boardType: string | null | undefined): string {
  if (!boardType) return ""
  return BOARD_TYPE_LABELS[boardType] ?? boardType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}
