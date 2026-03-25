#!/usr/bin/env node
/**
 * Regenerate JS Surfboards index JSON files from a Thunderbit export.
 *
 * Expected schema:
 * - Product Name, Product URL, Product Image
 * - Price (USD), Product Type, Board Series, Product Description
 * - Available Colors, Fin Setup, Standard Dimensions
 * - Wave Type, Features, Concave, Construction
 *
 * Usage:
 *   node scripts/import-js-surfboards-thunderbit.mjs /path/to/export.json
 */
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import { createHash } from "crypto"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, "..", "lib", "index-directory", "data")

const inputPath = process.argv[2]
if (!inputPath || !fs.existsSync(inputPath)) {
  console.error("Usage: node scripts/import-js-surfboards-thunderbit.mjs <export.json>")
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

function secondLineUrl(s) {
  const lines = String(s || "")
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean)
  return lines[1] || ""
}

function urlHash(u) {
  return createHash("sha1").update(String(u)).digest("hex").slice(0, 8)
}

function buildGallery(row) {
  const hero = firstLineUrl(row["Product Image"])
  const listing = secondLineUrl(row["Product Image"])
  const items = []
  function push(url, caption) {
    if (!url) return
    items.push({ url, caption })
  }
  push(hero, "Board")
  if (listing && listing !== hero) push(listing, "Listing")
  return items
}

function parseStockDims(dimStr) {
  const lines = String(dimStr || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
  return lines.map((line) => ({ raw: line.replace(/\s+/g, " ").trim() }))
}

function parseUsd(price) {
  const t = String(price || "").trim()
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

const brandSlug = "js-surfboards"
const firstRow = raw[0]
const brandLogoUrl =
  secondLineUrl(firstRow["Product Image"]) || firstLineUrl(firstRow["Product Image"])

const slugUsed = new Set()
const rowSlugByIndex = raw.map((row) => {
  const name = row["Product Name"]
  const productUrl = String(row["Product URL"] || "").trim()
  const baseSlug = slugify(name)
  let candidate = baseSlug
  if (slugUsed.has(candidate)) {
    candidate = `${baseSlug}-${urlHash(productUrl)}`
  }
  let i = 2
  while (slugUsed.has(candidate)) {
    candidate = `${baseSlug}-${urlHash(productUrl)}-${i}`
    i += 1
  }
  slugUsed.add(candidate)
  return candidate
})

const models = raw.map((row, idx) => ({
  slug: rowSlugByIndex[idx],
  name: String(row["Product Name"] || "").trim(),
  productUrl: String(row["Product URL"] || "").trim(),
  imageUrl: firstLineUrl(row["Product Image"]),
  entryRocker: null,
  exitRocker: null,
  rockerStyle: null,
}))

const brand = {
  slug: brandSlug,
  kind: "brand",
  name: "JS Surfboards",
  shortDescription: "High-performance boards from Jason Stevenson's JS Industries.",
  websiteUrl: "https://us.jsindustries.com",
  logoUrl: brandLogoUrl,
  founderName: "Jason Stevenson",
  leadShaperName: "Jason Stevenson",
  locationLabel: "Gold Coast, Australia",
  aboutParagraphs: [
    "JS Industries is a high-performance surfboard brand founded and shaped by Jason Stevenson on Australia's Gold Coast.",
    "Known for team-driven R&D and constructions from PU to softboards, JS boards are ridden worldwide in competition and everyday sessions.",
  ],
  models,
}

const detailsBySlug = {}
for (const [idx, row] of raw.entries()) {
  const modelSlug = rowSlugByIndex[idx]
  const paras = []

  const desc = String(row["Product Description"] || "").trim()
  if (desc) paras.push(desc)

  const productType = String(row["Product Type"] || "").trim()
  if (productType) paras.push("Product type: " + productType)

  const series = String(row["Board Series"] || "").trim()
  if (series) paras.push("Series: " + series)

  const waveType = String(row["Wave Type"] || "").trim()
  if (waveType) paras.push("Wave type: " + waveType)

  const finSetup = String(row["Fin Setup"] || "").trim()
  if (finSetup) paras.push("Fin setup: " + finSetup)

  const colors = String(row["Available Colors"] || "").trim()
  if (colors) paras.push("Available colors: " + colors.replace(/\n/g, ", "))

  const features = String(row["Features"] || "").trim()
  if (features) paras.push("Features: " + features)

  const concave = String(row["Concave"] || "").trim()
  if (concave) paras.push("Bottom contour: " + concave)

  const construction = String(row["Construction"] || "").trim()
  if (construction) paras.push("Construction: " + construction)

  const stockDims = parseStockDims(row["Standard Dimensions"])
  const priceUsd = parseUsd(row["Price (USD)"])
  const galleryImages = buildGallery(row)
  const marketingImageUrl = firstLineUrl(row["Product Image"])

  detailsBySlug[modelSlug] = {
    brandSlug,
    modelSlug,
    descriptionParagraphs: paras,
    priceUsd,
    ...(marketingImageUrl ? { marketingImageUrl } : {}),
    ...(galleryImages.length ? { galleryImages } : {}),
    waveSizeLabels: [],
    skillLevelLabels: [],
    stockDims,
  }
}

fs.writeFileSync(path.join(root, "js-surfboards.json"), JSON.stringify(brand, null, 2))
fs.writeFileSync(
  path.join(root, "js-surfboards-model-details.json"),
  JSON.stringify(detailsBySlug, null, 2),
)

console.log(`Wrote ${models.length} models to js-surfboards.json and js-surfboards-model-details.json`)
