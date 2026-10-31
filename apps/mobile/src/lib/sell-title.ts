import { SURFBOARDS_CATEGORY_SLUG } from "@/lib/sell-flow"

const TITLE_MAX = 160

/**
 * Same title display as website `formatBoardLengthForTitle` for picker values like `6'0`.
 * Returns `6'0"` (with trailing inch mark) when feet+inches parse.
 */
export function formatBoardLengthForSellTitle(boardLength: string): string {
  const raw = boardLength.trim().replace(/[\u2032\u2019＇]/g, "'")
  if (!raw) return ""
  if (!raw.includes("'")) return ""
  const idx = raw.indexOf("'")
  const feetStr = raw.slice(0, idx).replace(/\D/g, "")
  let inchesStr = raw.slice(idx + 1).trim()
  inchesStr = inchesStr.replace(/^["\u201c\u201d]+|["\u201c\u201d]+$/g, "").trim()
  const ft = Number.parseInt(feetStr, 10)
  if (!Number.isFinite(ft) || ft < 1 || ft > 15) return ""
  if (inchesStr === "") return ""
  const inchesNum = Number.parseFloat(inchesStr)
  if (!Number.isFinite(inchesNum) || inchesNum < 0 || inchesNum >= 12) return ""
  const inchesLabel = Number.isInteger(inchesNum) ? String(inchesNum) : String(Number(inchesNum.toFixed(3)))
  return `${ft}'${inchesLabel}"`
}

/**
 * Website sell title sync: `6'0 Brand Model` for surfboards when length is set,
 * otherwise `Brand Model`. Empty parts are omitted.
 */
export function suggestedSellTitle(input: {
  category: string
  brand: string
  model: string
  boardLength: string
}): string | null {
  const brand = input.brand.trim()
  const model = input.model.trim()
  if (!brand && !model) return null
  const lengthPart =
    input.category === SURFBOARDS_CATEGORY_SLUG ? formatBoardLengthForSellTitle(input.boardLength) : ""
  const suggestion = [lengthPart, brand, model].filter(Boolean).join(" ").trim()
  if (!suggestion || suggestion.length > TITLE_MAX) return null
  return suggestion
}
