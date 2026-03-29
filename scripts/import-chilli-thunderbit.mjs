#!/usr/bin/env node
/**
 * Regenerate lib/index-directory/data/chilli-surfboards.json and
 * chilli-surfboards-model-details.json from a Thunderbit JSON export (Chilli catalog).
 *
 * Fields: Surfboard Name, Surfboard URL, Surfboard Image, Price (USD), Board Type,
 * Skill Level, Surfboard Description, Fin Recommendation, Tail Type, Rail Type,
 * Fin Setup, Standard Dimensions, Product images (JSON array string).
 *
 * Usage: node scripts/import-chilli-thunderbit.mjs /path/to/export.json
 */
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, "..", "lib", "index-directory", "data")

const inputPath = process.argv[2]
if (!inputPath || !fs.existsSync(inputPath)) {
  console.error("Usage: node scripts/import-chilli-thunderbit.mjs <export.json>")
  process.exit(1)
}

const raw = JSON.parse(fs.readFileSync(inputPath, "utf8"))

function slugify(name) {
  return name
    .replace(/'/g, "")
    .replace(/[()]/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

function uniqueSlug(base, used) {
  let s = base
  let i = 2
  while (used.has(s)) {
    s = `${base}-${i}`
    i += 1
  }
  used.add(s)
  return s
}

function parsePriceUsd(s) {
  const t = String(s || "").trim().replace(/,/g, "")
  if (!t) return null
  const n = Number.parseFloat(t)
  return Number.isFinite(n) ? Math.round(n) : null
}

function galleryUrlKey(u) {
  try {
    const x = new URL(u)
    return `${x.host}${x.pathname}`.toLowerCase()
  } catch {
    return u.toLowerCase()
  }
}

function isJunkImageUrl(u) {
  return /boardswidget|widget_shadow|placeholder|favicon/i.test(u)
}

function parseProductImages(s) {
  const t = String(s || "").trim()
  if (!t) return []
  try {
    const arr = JSON.parse(t)
    if (!Array.isArray(arr)) return []
    return arr.map((u) => String(u).trim()).filter(Boolean)
  } catch {
    return []
  }
}

function buildGallery(primary, productImagesField) {
  const seen = new Set()
  const items = []
  function push(url, caption) {
    if (!url || isJunkImageUrl(url)) return
    const k = galleryUrlKey(url)
    if (seen.has(k)) return
    seen.add(k)
    items.push({ url, caption })
  }
  push(String(primary || "").trim(), "Model")
  const extra = parseProductImages(productImagesField)
  let i = 0
  for (const url of extra) {
    if (!url || isJunkImageUrl(url)) continue
    const k = galleryUrlKey(url)
    if (seen.has(k)) continue
    seen.add(k)
    i += 1
    push(url, `Photo ${i + 1}`)
  }
  return items
}

function skillLabelsFromRow(row) {
  const t = String(row["Skill Level"] || "").trim()
  if (!t) return []
  return t
    .split(/[,/]|(?:\s+and\s+)/i)
    .map((s) => s.trim())
    .filter(Boolean)
}

const usedSlugs = new Set()
const rows = []

for (const row of raw) {
  const name = String(row["Surfboard Name"] || "").trim()
  if (!name) continue
  const base = slugify(name)
  const slug = uniqueSlug(base || "model", usedSlugs)
  rows.push({ row, name, slug })
}

const models = rows.map(({ row, name, slug }) => ({
  slug,
  name,
  productUrl: String(row["Surfboard URL"] || "").trim(),
  imageUrl: String(row["Surfboard Image"] || "").trim(),
  entryRocker: null,
  exitRocker: null,
  rockerStyle: null,
}))

const brand = {
  slug: "chilli-surfboards",
  kind: "brand",
  name: "Chilli Surfboards",
  shortDescription:
    "Performance and everyday shortboards from Chilli — crafted in Australia with models for groms, small-wave grovelers, and serious waves.",
  websiteUrl: "https://www.chillisurfboards.com",
  logoUrl: "https://www.chillisurfboards.com/images/chilli_black.png",
  founderName: "James Cheyne",
  leadShaperName: "James Cheyne",
  locationLabel: "Perth, Western Australia",
  aboutParagraphs: [
    "Chilli Surfboards is an Australian label known for versatile shortboard and hybrid designs, from youth-focused lines to world-tour shapes trusted in quality surf.",
    "Each model ships with detailed stock dimensions, fin recommendations, and construction options — reflected here from Chilli’s product catalog.",
  ],
  models,
}

const detailsBySlug = {}

for (const { row, slug } of rows) {
  const desc = String(row["Surfboard Description"] || "").trim()
  const paras = desc
    ? desc
        .split(/\n\n+/)
        .map((p) => p.trim().replace(/\n/g, " "))
        .filter(Boolean)
    : []

  const boardType = String(row["Board Type"] || "").trim()
  const fins = String(row["Fin Recommendation"] || "").trim()
  const tail = String(row["Tail Type"] || "").trim()
  const rail = String(row["Rail Type"] || "").trim()
  const finSetup = String(row["Fin Setup"] || "").trim()
  if (boardType) paras.push(`Board type: ${boardType}.`)
  if (tail) paras.push(`Tail: ${tail}.`)
  if (rail) paras.push(`Rails: ${rail}.`)
  if (finSetup) paras.push(`Fin setup: ${finSetup}.`)
  if (fins) paras.push(`Fin recommendation: ${fins}.`)

  const dimBlock = String(row["Standard Dimensions"] || "").trim()
  const stockDims = dimBlock
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => ({ raw: line }))

  const galleryImages = buildGallery(row["Surfboard Image"], row["Product images"])
  const primaryImage = galleryImages[0]?.url || String(row["Surfboard Image"] || "").trim()
  const priceUsd = parsePriceUsd(row["Price (USD)"])
  const skillLevelLabels = skillLabelsFromRow(row)

  detailsBySlug[slug] = {
    brandSlug: "chilli-surfboards",
    modelSlug: slug,
    descriptionParagraphs: paras.length ? paras : ["See Chilli’s site for full model notes."],
    priceUsd,
    ...(primaryImage ? { marketingImageUrl: primaryImage } : {}),
    ...(galleryImages.length ? { galleryImages } : {}),
    waveSizeLabels: [],
    skillLevelLabels,
    stockDims,
  }
}

fs.writeFileSync(path.join(root, "chilli-surfboards.json"), JSON.stringify(brand, null, 2))
fs.writeFileSync(
  path.join(root, "chilli-surfboards-model-details.json"),
  JSON.stringify(detailsBySlug, null, 2),
)
console.log(`Wrote ${models.length} models to chilli-surfboards.json and chilli-surfboards-model-details.json`)
