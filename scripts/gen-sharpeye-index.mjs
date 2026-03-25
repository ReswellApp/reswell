/**
 * One-off: reads Thunderbit exports and writes lib/index-directory/data/sharpeye-surfboards.json
 * plus model-details/sharpeye-surfboards-*.json. Re-run if source JSON changes.
 */
import fs from "node:fs"
import path from "node:path"

const ROOT = path.join(import.meta.dirname, "..")
const PRODUCTS_PATH = "/Users/hayden/Downloads/Thunderbit_0b8b19_20260325_053231.json"
const DATA_DIR = path.join(ROOT, "lib/index-directory/data")
const DETAILS_DIR = path.join(DATA_DIR, "model-details")

const BRAND_SLUG = "sharpeye-surfboards"

function slugFromProductUrl(url) {
  const m = String(url).match(/\/products\/([^/?#]+)/)
  return m ? m[1] : null
}

function firstRockerLine(s) {
  const line = String(s || "")
    .split("\n")
    .map((x) => x.trim())
    .find(Boolean)
  return line ? line.toLowerCase() : null
}

function rockerFields(entry, exit) {
  const el = firstRockerLine(entry)
  const xl = firstRockerLine(exit)
  if (!el && !xl) return { entryRocker: null, exitRocker: null, rockerStyle: null }
  const linesE = String(entry || "")
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean)
  const linesX = String(exit || "")
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean)
  const multi = linesE.length > 1 || linesX.length > 1
  return {
    entryRocker: el,
    exitRocker: xl,
    rockerStyle: multi ? "variable" : null,
  }
}

function waveSizeLabels(waveFeetRaw) {
  const nums = String(waveFeetRaw || "")
    .split(/\n/)
    .map((x) => parseInt(x.trim(), 10))
    .filter((n) => !Number.isNaN(n))
  if (nums.length === 0) return []
  const min = Math.min(...nums)
  const max = Math.max(...nums)
  const out = []
  if (min <= 2) out.push("Small")
  if (max >= 3 && min <= 5) out.push("Medium")
  if (max >= 5) out.push("Overhead")
  return [...new Set(out)]
}

function skillLevelLabels(raw) {
  return String(raw || "")
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean)
}

function parseStockDims(stockDimensionsRaw) {
  const raw = String(stockDimensionsRaw || "")
  let arr = null
  try {
    arr = JSON.parse(raw)
  } catch {
    /* Thunderbit often exports broken JSON (inches quotes inside strings). */
  }
  if (Array.isArray(arr)) {
    return arr.map((s) => stockDimRowFromString(String(s).trim())).filter(Boolean)
  }
  const rows = []
  const re = /(\d+'(?:\d+)?)" x ([\d.]+) x ([\d.]+) ([\d.]+) L/g
  let m
  while ((m = re.exec(raw)) !== null) {
    rows.push({
      length: `${m[1]}"`,
      width: m[2],
      thickness: m[3],
      volume: `${m[4]}L`,
    })
  }
  return rows
}

function stockDimRowFromString(str) {
  const m = str.match(/^(.+?)\s+x\s+([\d.]+)\s+x\s+([\d.]+)\s+([\d.]+)\s*L$/i)
  if (m) {
    return {
      length: m[1].trim(),
      width: m[2],
      thickness: m[3],
      volume: `${m[4]}L`,
    }
  }
  return str ? { raw: str } : null
}

function overviewParagraphs(overview) {
  return String(overview || "")
    .split(/\n\n+/)
    .map((p) => p.trim().replace(/\n/g, " "))
    .filter(Boolean)
}

const products = JSON.parse(fs.readFileSync(PRODUCTS_PATH, "utf8"))

/** Title-case scraped ALL-CAPS product names (e.g. INFERNO 72 (E3 LITE) → Inferno 72 (E3 LITE)). */
function titleName(raw) {
  const s = String(raw || "").trim()
  if (!s) return s
  const ACRONYMS = new Set(["e3", "c1", "lite", "yth", "ft", "ii", "pu", "pe", "eps"])
  const lower = s.toLowerCase()
  const tokens = lower.match(/\([^)]+\)|[^\s()]+/g) || []
  return tokens
    .map((tok) => {
      if (tok.startsWith("(")) {
        const inner = tok
          .slice(1, -1)
          .trim()
          .split(/\s+/)
          .map((w) => (ACRONYMS.has(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
          .join(" ")
        return `(${inner})`
      }
      if (/^#\d+$/.test(tok)) return tok.toUpperCase()
      if (/^\d/.test(tok)) return tok.toUpperCase()
      if (ACRONYMS.has(tok)) return tok.toUpperCase()
      return tok.charAt(0).toUpperCase() + tok.slice(1)
    })
    .join(" ")
}

const models = []
const seenSlug = new Set()

for (const p of products) {
  const slug = slugFromProductUrl(p["Product URL"])
  if (!slug || seenSlug.has(slug)) continue
  seenSlug.add(slug)

  const { entryRocker, exitRocker, rockerStyle } = rockerFields(
    p["Entry Rocker"],
    p["Exit Rocker"],
  )

  models.push({
    slug,
    name: titleName(p["Product Name"] || slug),
    productUrl: p["Product URL"],
    imageUrl: p["Product Image"].split("&width=")[0] + "&width=2000",
    entryRocker,
    exitRocker,
    rockerStyle,
  })

  const priceRaw = parseFloat(String(p["Price (USD)"] || "").replace(/,/g, ""))
  const detail = {
    brandSlug: BRAND_SLUG,
    modelSlug: slug,
    descriptionParagraphs: overviewParagraphs(p["Overview"]),
    priceUsd: Number.isFinite(priceRaw) ? priceRaw : null,
    marketingImageUrl: p["Product Image"].split("&width=")[0] + "&width=2000",
    galleryImages: [
      {
        url: p["Product Image"].split("&width=")[0] + "&width=2000",
        caption: titleName(p["Product Name"] || slug),
      },
    ],
    waveSizeLabels: waveSizeLabels(p["Wave Height (Feet)"]),
    skillLevelLabels: skillLevelLabels(p["Ability Level"]),
    stockDims: parseStockDims(p["Stock Dimensions"]),
  }

  const detailPath = path.join(DETAILS_DIR, `${BRAND_SLUG}-${slug}.json`)
  fs.writeFileSync(detailPath, JSON.stringify(detail, null, 2) + "\n", "utf8")
}

const brand = {
  slug: BRAND_SLUG,
  kind: "brand",
  name: "Sharp Eye Surfboards",
  shortDescription:
    "San Diego performance shortboards since 1992 — Marcio Zouvi and the SharpEye team, trusted by world-tour surfers.",
  websiteUrl: "https://sharpeyesurfboards.com",
  logoUrl:
    "https://sharpeyesurfboards.com/cdn/shop/files/SharpEye_Logo_475d5082-8d0c-40a7-a6d0-ea96766165b4.png?v=1&width=800",
  founderName: "Marcio Zouvi",
  leadShaperName: "Marcio Zouvi",
  locationLabel: "San Diego, California",
  aboutParagraphs: [
    "SharpEye's head shaper Marcio Zouvi began his shaping career in the late 1980s with Californian influences including Rusty, Linden, and Al Merrick. Born and raised in Rio de Janeiro, Brazil, he founded Sharp Eye Surfboards in 1992. With decades of experience he is known as a meticulous craftsman — details matter, and the brand's promise is Zero Compromise on service and quality.",
    "SharpEye Surfboards is built around high-performance shortboards for progressive surfing — designs that help everyday surfers and the world's best push what's possible in the water.",
    "Boards are made in the USA from premium materials, with stock PU/PE lamination plus EPS/epoxy and carbon/epoxy options on many models. Headquarters: 3351 Hancock St, San Diego, CA 92110.",
  ],
  models,
}

fs.writeFileSync(
  path.join(DATA_DIR, "sharpeye-surfboards.json"),
  JSON.stringify(brand, null, 2) + "\n",
  "utf8",
)

const IDX_DIR = path.join(ROOT, "lib/index-directory")
const detailFiles = fs
  .readdirSync(DETAILS_DIR)
  .filter((f) => f.startsWith(`${BRAND_SLUG}-`) && f.endsWith(".json"))
  .sort()

const genLines = [
  "/** Auto-generated by scripts/gen-sharpeye-index.mjs — do not edit by hand. */",
  'import type { BoardModelDetail } from "./types"',
  ...detailFiles.map((f, i) => `import se_detail_${i} from "./data/model-details/${f}"`),
  "",
  "export const sharpeyeSurfboardsModelDetailsBySlug: Record<string, BoardModelDetail> = {",
  ...detailFiles.map((f, i) => {
    const slug = f.slice(`${BRAND_SLUG}-`.length, -".json".length)
    return `  ${JSON.stringify(slug)}: se_detail_${i} as BoardModelDetail,`
  }),
  "}",
  "",
]

fs.writeFileSync(path.join(IDX_DIR, "sharpeye-model-details.generated.ts"), genLines.join("\n"), "utf8")

console.log(`Wrote ${models.length} models, brand JSON, and sharpeye-model-details.generated.ts`)
