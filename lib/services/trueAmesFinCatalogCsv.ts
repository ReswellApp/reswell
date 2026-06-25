import { readFileSync } from "node:fs"
import { homedir } from "node:os"
import { resolve } from "node:path"
import { isValidHttpImageSource } from "@/lib/services/brandCatalogImageStorage"

export type TrueAmesFinCsvRow = {
  productName: string
  productUrl: string
  productImage: string
  priceUsd: string
  finCompatibility: string
  finType: string
  boardType: string
  productDescription: string
  availableSizes: string
  availableColors: string
  specifications: string
  materialsFitment: string
  productImageVariants: string
}

export const DEFAULT_TRUE_AMES_FIN_CSV = resolve(
  homedir(),
  "Downloads/Thunderbit_0b8b19_20260625_225230.csv",
)

/** Minimal RFC 4180 CSV parser for quoted fields. */
export function parseThunderbitCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const next = text[i + 1]

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"'
        i++
      } else if (ch === '"') {
        inQuotes = false
      } else {
        field += ch
      }
      continue
    }

    if (ch === '"') {
      inQuotes = true
    } else if (ch === ",") {
      row.push(field)
      field = ""
    } else if (ch === "\n" || (ch === "\r" && next === "\n")) {
      row.push(field)
      field = ""
      if (row.some((c) => c.length > 0)) rows.push(row)
      row = []
      if (ch === "\r") i++
    } else if (ch !== "\r") {
      field += ch
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field)
    if (row.some((c) => c.length > 0)) rows.push(row)
  }

  if (rows.length === 0) return []
  const headers = rows[0].map((h) => h.trim())
  return rows.slice(1).map((cells) => {
    const obj: Record<string, string> = {}
    headers.forEach((h, idx) => {
      obj[h] = cells[idx] ?? ""
    })
    return obj
  })
}

export function toTrueAmesFinCsvRow(raw: Record<string, string>): TrueAmesFinCsvRow {
  return {
    productName: raw["Product Name"]?.trim() ?? "",
    productUrl: raw["Product URL"]?.trim() ?? "",
    productImage: raw["Product Image"]?.trim() ?? "",
    priceUsd: raw["Price (USD)"]?.trim() ?? "",
    finCompatibility: raw["Fin Compatibility"]?.trim() ?? "",
    finType: raw["Fin Type"]?.trim() ?? "",
    boardType: raw["Board Type"]?.trim() ?? "",
    productDescription: raw["Product Description"]?.trim() ?? "",
    availableSizes: raw["Available Sizes"]?.trim() ?? "",
    availableColors: raw["Available Colors"]?.trim() ?? "",
    specifications: raw["Specifications"]?.trim() ?? "",
    materialsFitment: raw["Materials & Fitment"]?.trim() ?? "",
    productImageVariants: raw["Product Image Variants"]?.trim() ?? "",
  }
}

function splitLines(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function parseImageVariants(raw: string): string[] {
  const t = raw.trim()
  if (!t) return []
  if (t.startsWith("[")) {
    try {
      const parsed = JSON.parse(t) as unknown
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (u): u is string => typeof u === "string" && isValidHttpImageSource(u),
        )
      }
    } catch {
      // fall through
    }
  }
  return splitLines(t).filter((u) => isValidHttpImageSource(u))
}

function pickImageForColor(fallback: string, color: string, variantUrls: string[]): string {
  if (!color.trim()) return fallback
  const colorKey = color.trim().toLowerCase()
  const aliases: Record<string, string[]> = {
    smoke: ["smk", "smoke"],
    clear: ["clr", "clear"],
    red: ["red"],
    blue: ["blu", "blue"],
    green: ["grn", "green"],
    yellow: ["yel", "yellow"],
    orange: ["org", "orange"],
    black: ["blk", "black"],
    white: ["wht", "white"],
    kelp: ["kelp"],
    volcanic: ["vol", "volcanic"],
    sand: ["sand"],
    cream: ["cream", "crm"],
    "royal blue": ["royal", "blue", "blu"],
    ivory: ["ivory", "ivory"],
  }
  const needles = aliases[colorKey] ?? [colorKey.replace(/^fin-/, "")]
  for (const url of variantUrls) {
    const lower = url.toLowerCase()
    if (needles.some((n) => lower.includes(n))) return url
  }
  return fallback
}

/** Prefer full product photos over Shopify color swatches (`_50x`). */
export function preferFullProductImageUrl(url: string): string {
  const t = url.trim()
  if (!t) return t
  if (/_50x/i.test(t)) {
    return t.replace(/_50x/gi, "_360x504")
  }
  if (/_360x(?!\d)/i.test(t)) {
    return t.replace(/_360x(?!\d)/gi, "_360x504")
  }
  return t
}

export function resolveTrueAmesVariantImageFromCsv(
  row: TrueAmesFinCsvRow,
  colorLabel: string,
): string | null {
  const variantImages = parseImageVariants(row.productImageVariants).map(preferFullProductImageUrl)
  const fallback = preferFullProductImageUrl(row.productImage)
  const picked = pickImageForColor(fallback, colorLabel, variantImages)
  const candidate = picked?.trim() || fallback || null
  return isValidHttpImageSource(candidate)
    ? candidate
    : isValidHttpImageSource(fallback)
      ? fallback
      : null
}

export function loadTrueAmesFinCsvByProductName(csvPath: string): Map<string, TrueAmesFinCsvRow> {
  const text = readFileSync(csvPath, "utf8")
  const map = new Map<string, TrueAmesFinCsvRow>()
  for (const raw of parseThunderbitCsv(text)) {
    const row = toTrueAmesFinCsvRow(raw)
    if (row.productName) map.set(row.productName, row)
  }
  return map
}

export function resolveTrueAmesModelImageFromCsv(row: TrueAmesFinCsvRow): string | null {
  const url = preferFullProductImageUrl(row.productImage)
  return isValidHttpImageSource(url) ? url : null
}
