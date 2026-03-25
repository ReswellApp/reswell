#!/usr/bin/env node
/**
 * Regenerate Hayden Shapes index JSON files from a Thunderbit export.
 *
 * Expected Thunderbit schema (based on the provided export):
 * - Product Name
 * - Product URL
 * - Product Image (may contain 2 lines: hero image + listing/logo image)
 * - Model Overview
 * - Skill Level
 * - Conditions
 * - Suitable Wave Faces
 * - Technology
 * - Fin System
 * - Dimensions (newline-separated lines; we store as raw rows)
 *
 * Usage:
 *   node scripts/import-hayden-shapes-thunderbit.mjs /path/to/export.json
 */
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import { createHash } from "crypto"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, "..", "lib", "index-directory", "data")

const inputPath = process.argv[2]
if (!inputPath || !fs.existsSync(inputPath)) {
  console.error("Usage: node scripts/import-hayden-shapes-thunderbit.mjs <export.json>")
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

function buildGallery(product) {
  const hero = firstLineUrl(product["Product Image"])
  const listing = secondLineUrl(product["Product Image"])

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

  // Keep it robust: these lines can include mixed formatting/availability.
  // The app schema supports `{ raw }` rows.
  return lines.map((line) => ({ raw: line.replace(/\s+/g, " ").trim() }))
}

function parseUsd(price) {
  const t = String(price || "").trim()
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

const brandSlug = "hayden-shapes"
const firstRow = raw[0]

const brandLogoUrl = secondLineUrl(firstRow["Product Image"]) || firstLineUrl(firstRow["Product Image"])

function urlHash(u) {
  return createHash("sha1").update(String(u)).digest("hex").slice(0, 8)
}

const slugUsed = new Set()
const rowSlugByIndex = raw.map((row) => {
  const name = row["Product Name"]
  const productUrl = String(row["Product URL"] || "").trim()

  const baseSlug = slugify(name)
  let candidate = baseSlug

  if (slugUsed.has(candidate)) {
    // Collision: the Thunderbit export may contain the same product name for multiple URLs.
    candidate = `${baseSlug}-${urlHash(productUrl)}`
  }

  // Extremely defensive: keep bumping until unique.
  let i = 2
  while (slugUsed.has(candidate)) {
    candidate = `${baseSlug}-${urlHash(productUrl)}-${i}`
    i += 1
  }

  slugUsed.add(candidate)
  return candidate
})

const models = raw.map((row, idx) => {
  const slug = rowSlugByIndex[idx]
  return {
    slug,
    name: String(row["Product Name"] || "").trim(),
    productUrl: String(row["Product URL"] || "").trim(),
    imageUrl: firstLineUrl(row["Product Image"]),
    entryRocker: null,
    exitRocker: null,
    rockerStyle: null,
  }
})

const brand = {
  slug: brandSlug,
  kind: "brand",
  name: "Hayden Shapes",
  shortDescription: "FutureFlex performance surfboards from Sydney.",
  websiteUrl: "https://www.haydenshapes.com",
  logoUrl: brandLogoUrl,
  founderName: "Hayden Cox",
  leadShaperName: "Hayden Cox",
  locationLabel: "Sydney, Australia",
  aboutParagraphs: [
    "Haydenshapes is a performance surfboard brand founded by Hayden Cox in Sydney, Australia.",
    "Our patented parabolic carbon fiber frame construction is called FutureFlex.",
  ],
  models,
}

const detailsBySlug = {}
for (const [idx, row] of raw.entries()) {
  const modelSlug = rowSlugByIndex[idx]

  const paras = []
  const overview = String(row["Model Overview"] || "").trim()
  if (overview) paras.push(overview)

  const skill = String(row["Skill Level"] || "").trim()
  if (skill) paras.push("Skill level: " + skill)

  const conditions = String(row["Conditions"] || "").trim()
  if (conditions) paras.push("Conditions: " + conditions)

  const waveFaces = String(row["Suitable Wave Faces"] || "").trim()
  if (waveFaces) paras.push("Wave faces: " + waveFaces)

  const technology = String(row["Technology"] || "").trim()
  if (technology) paras.push("Technology: " + technology)

  const finSystem = String(row["Fin System"] || "").trim()
  if (finSystem) paras.push("Fin system: " + finSystem)

  const stockDims = parseStockDims(row["Dimensions"])
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

fs.writeFileSync(path.join(root, "hayden-shapes.json"), JSON.stringify(brand, null, 2))
fs.writeFileSync(
  path.join(root, "hayden-shapes-model-details.json"),
  JSON.stringify(detailsBySlug, null, 2),
)

console.log(`Wrote ${models.length} models to hayden-shapes.json and hayden-shapes-model-details.json`)

