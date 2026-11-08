/**
 * USPS address validation often returns preferred-last-line abbreviations
 * (`VIRGINIA BCH`). Some rating APIs then fail to quote Ground/Priority.
 * Expand the unambiguous city tokens so checkout still rates.
 */
const USPS_CITY_WORD: Record<string, string> = {
  BCH: "Beach",
  HTS: "Heights",
  HGTS: "Heights",
  SPG: "Springs",
  SPGS: "Springs",
  VLY: "Valley",
  JCT: "Junction",
  MTN: "Mountain",
  CYN: "Canyon",
}

function titleCaseWord(word: string): string {
  const lower = word.toLowerCase()
  if (!lower) return word
  return lower.charAt(0).toUpperCase() + lower.slice(1)
}

export function expandUspsAbbreviatedCityName(city: string | null | undefined): string {
  const raw = (city ?? "").trim()
  if (!raw) return ""
  const words = raw.split(/\s+/)
  let changed = false
  const expanded = words.map((word) => {
    const key = word.replace(/[^A-Za-z]/g, "").toUpperCase()
    const mapped = USPS_CITY_WORD[key]
    if (!mapped) return word
    changed = true
    return mapped
  })
  if (!changed) return raw
  return expanded.map(titleCaseWord).join(" ")
}
