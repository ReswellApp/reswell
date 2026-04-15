/** Board shape key → surfboard category UUID (matches `public.categories` + migrations). */
export const boardCategoryMap: Record<string, string> = {
  shortboard: "7e434a96-f3f7-4a73-b733-704a769195e6",
  longboard: "47a0d0bb-8738-43b4-a0fe-a5b2acc72fa3",
  hybrid: "93b8eeaf-366b-4823-8bb9-98d42c5fefba",
  "step-up-gun": "91c4e8a2-3f5b-4d1c-9e6a-7b8c9d0e1f2a",
  groveler: "f3ccddc0-f0f3-45d3-ad43-51bcf9935b45",
  other: "7e434a96-f3f7-4a73-b733-704a769195e6",
}

/** Map surfboard category row id → `listings.board_type` (multiple keys can share one UUID). */
export function boardTypeFromCategoryId(categoryId: string): string {
  const keys = Object.entries(boardCategoryMap)
    .filter(([, uuid]) => uuid === categoryId)
    .map(([bt]) => bt)
  if (keys.length === 0) return "other"
  if (keys.includes("shortboard")) return "shortboard"
  if (keys.includes("hybrid")) return "hybrid"
  if (keys.includes("step-up-gun")) return "step-up-gun"
  if (keys.includes("longboard")) return "longboard"
  if (keys.includes("groveler")) return "groveler"
  return keys[0]
}
