#!/usr/bin/env node
/**
 * Regenerate Lost Surfboards index JSON files from a Thunderbit export.
 *
 * Expects each row to include:
 * - Surfboard Name
 * - Surfboard URL
 * - Surfboard Image (may contain 2 lines: hero image + series logo)
 * - Surfboard Description
 * - Board Series
 * - Board Shapes
 * - Collaborations
 * - Stock Dimensions
 * - Surfboard Gallery Images (may be newline-separated URLs or a JSON array string)
 *
 * Usage:
 *   node scripts/import-lost-surfboards-thunderbit.mjs /path/to/export.json
 */
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, "..", "lib", "index-directory", "data")

const inputPath = process.argv[2]
if (!inputPath || !fs.existsSync(inputPath)) {
  console.error("Usage: node scripts/import-lost-surfboards-thunderbit.mjs <export.json>")
  process.exit(1)
}

const raw = JSON.parse(fs.readFileSync(inputPath, "utf8"))
if (!Array.isArray(raw) || raw.length === 0) {
  console.error("Thunderbit export should be a non-empty JSON array")
  process.exit(1)
}

function slugify(name) {
  return String(name || "")
    .replace(/'/g, "")
    .replace(/[()]/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

function firstLineUrl(s) {
  const line = String(s || "")
    .split("\n")
    .map((x) => x.trim())
    .find(Boolean)
  return line || ""
}

function splitUrls(s) {
  const t = String(s || "").trim()
  if (!t) return []

  // Some exports encode URLs as a JSON array string.
  if (t.startsWith("[") && t.endsWith("]")) {
    try {
      const arr = JSON.parse(t)
      return Array.isArray(arr) ? arr.map((u) => String(u).trim()).filter(Boolean) : []
    } catch {
      // fall through to newline/whitespace parsing
    }
  }

  // Default: newline-separated URLs.
  return t
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean)
}

function urlKey(u) {
  try {
    const x = new URL(u)
    return `${x.host}${x.pathname}`
  } catch {
    return u
  }
}

function parseStockDims(s) {
  const lines = String(s || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)

  return lines.map((line) => {
    const parts = line.split("|").map((p) => p.trim()).filter(Boolean)
    if (parts.length === 4) {
      return {
        length: parts[0],
        width: parts[1],
        thickness: parts[2],
        volume: parts[3],
      }
    }
    return { raw: line }
  })
}

function buildGallery(row) {
  const seen = new Set()
  const items = []

  function push(url, caption) {
    if (!url) return
    const k = urlKey(url)
    if (seen.has(k)) return
    seen.add(k)
    items.push({ url, caption })
  }

  const surfImgLines = String(row["Surfboard Image"] || "")
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean)

  const primary = surfImgLines[0] || ""
  const extraGallery = splitUrls(row["Surfboard Gallery Images"])

  push(primary, "Board")
  let i = 0
  for (const u of extraGallery) {
    i += 1
    push(u, `Photo ${i}`)
  }

  return items
}

const brandSlug = "lost-surfboards"
const firstRow = raw[0]
const firstImgLines = String(firstRow["Surfboard Image"] || "")
  .split("\n")
  .map((x) => x.trim())
  .filter(Boolean)
const brandLogoUrl = firstImgLines[1] || firstImgLines[0] || ""

const models = raw.map((row) => {
  const name = row["Surfboard Name"]
  const slug = slugify(name)

  const surfImgLines = String(row["Surfboard Image"] || "")
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean)
  const imageUrl = surfImgLines[0] || ""

  return {
    slug,
    name: String(name || "").trim(),
    productUrl: String(row["Surfboard URL"] || "").trim(),
    imageUrl,
    // Rocker/feel fields are not present in this export.
    entryRocker: null,
    exitRocker: null,
    rockerStyle: null,
  }
})

const brand = {
  slug: brandSlug,
  kind: "brand",
  name: "Lost Surfboards",
  shortDescription: "Performance surfboards handcrafted since 1985",
  websiteUrl: "https://lostsurfboards.net",
  logoUrl: brandLogoUrl,
  founderName: "Matt \"Mayhem\" Biolos",
  leadShaperName: "Matt \"Mayhem\" Biolos",
  locationLabel: "San Clemente, California",
  aboutParagraphs: [
    "Lost Surfboards is a performance surfboard brand known for retro-inspired shapes.",
    "Founded by Matt \"Mayhem\" Biolos in 1985, the lineup spans multiple series built for real-world surfing.",
  ],
  models,
}

const detailsBySlug = {}
for (const row of raw) {
  const modelName = row["Surfboard Name"]
  const modelSlug = slugify(modelName)

  const surfImgLines = String(row["Surfboard Image"] || "")
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean)
  const marketingImageUrl = surfImgLines[0] || ""

  const paras = []
  const surfboardDesc = String(row["Surfboard Description"] || "").trim()
  if (surfboardDesc) paras.push(surfboardDesc)

  const series = String(row["Board Series"] || "").trim()
  if (series) paras.push("Series: " + series)

  const shapes = String(row["Board Shapes"] || "").trim()
  if (shapes) paras.push("Shapes: " + shapes)

  const collaborations = String(row["Collaborations"] || "").trim()
  if (collaborations) paras.push("Collaborations: " + collaborations)

  const galleryImages = buildGallery(row)
  const stockDims = parseStockDims(row["Stock Dimensions"])

  detailsBySlug[modelSlug] = {
    brandSlug,
    modelSlug,
    descriptionParagraphs: paras,
    priceUsd: null,
    ...(marketingImageUrl ? { marketingImageUrl } : {}),
    ...(galleryImages.length ? { galleryImages } : {}),
    waveSizeLabels: [],
    skillLevelLabels: [],
    stockDims,
  }
}

fs.writeFileSync(path.join(root, "lost-surfboards.json"), JSON.stringify(brand, null, 2))
fs.writeFileSync(
  path.join(root, "lost-surfboards-model-details.json"),
  JSON.stringify(detailsBySlug, null, 2),
)

console.log(`Wrote ${models.length} models to lost-surfboards.json and lost-surfboards-model-details.json`)

