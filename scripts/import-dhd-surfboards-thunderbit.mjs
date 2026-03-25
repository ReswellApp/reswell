#!/usr/bin/env node
/**
 * Regenerate DHD Surfboards index JSON files from a Thunderbit export.
 *
 * Expected schema:
 * - Product Name, Product URL, Product Image
 * - Price (AUD) — omitted from model detail priceUsd (app formats as USD)
 * - Product Description, Ability Level, Ideal Wave Size, Fin System, Color, Glassing
 * - Rocker, Concave, Rails, Tail, Fins, How It Surfs, Where It Sits In Your Quiver
 * - Available Lengths / Widths / Thicknesses / Volumes (L) (newline lists, zipped by row index)
 *
 * Usage:
 *   node scripts/import-dhd-surfboards-thunderbit.mjs /path/to/export.json
 */
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import { createHash } from "crypto"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, "..", "lib", "index-directory", "data")

const inputPath = process.argv[2]
if (!inputPath || !fs.existsSync(inputPath)) {
  console.error("Usage: node scripts/import-dhd-surfboards-thunderbit.mjs <export.json>")
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

function splitLines(s) {
  return String(s || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
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

/** Zip parallel dimension lists into one stockDims row per index (missing tails ok). */
function zipStockDims(row) {
  const lengths = splitLines(row["Available Lengths"])
  const widths = splitLines(row["Available Widths"])
  const thicknesses = splitLines(row["Available Thicknesses"])
  const volumes = splitLines(row["Available Volumes (L)"])
  const n = Math.max(lengths.length, widths.length, thicknesses.length, volumes.length)
  const out = []
  for (let i = 0; i < n; i++) {
    const L = lengths[i]
    const W = widths[i]
    const T = thicknesses[i]
    const V = volumes[i]
    const parts = []
    if (L) parts.push(L)
    if (W) parts.push(W)
    if (T) parts.push(T)
    if (V) parts.push(V.endsWith("L") || V.includes("L") ? V : `${V}L`)
    if (parts.length) out.push({ raw: parts.join(" × ") })
  }
  return out
}

const brandSlug = "dhd-surfboards"
const firstRow = raw[0]
const brandLogoUrl =
  secondLineUrl(firstRow["Product Image"]) || firstLineUrl(firstRow["Product Image"])

const slugUsed = new Set()
const rowSlugByIndex = raw.map((row) => {
  const name = row["Product Name"]
  const productUrl = String(row["Product URL"] || "").trim()
  const baseSlug = slugify(name)
  let candidate = baseSlug
  if (slugUsed.has(candidate)) candidate = `${baseSlug}-${urlHash(productUrl)}`
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
  name: "DHD Surfboards",
  shortDescription: "Darren Handley Designs — high-performance boards from Burleigh.",
  websiteUrl: "https://dhdsurf.com",
  logoUrl: brandLogoUrl,
  founderName: "Darren Handley",
  leadShaperName: "Darren Handley",
  locationLabel: "Burleigh, Queensland, Australia",
  aboutParagraphs: [
    "DHD (Darren Handley Designs) Surfboards is an Australian high-performance surfboard brand.",
    "Known for team-driven R&D and World Tour–proven templates, DHD builds boards for everyday surfers and elite competitors alike.",
  ],
  models,
}

const detailsBySlug = {}
for (const [idx, row] of raw.entries()) {
  const modelSlug = rowSlugByIndex[idx]
  const paras = []

  const desc = String(row["Product Description"] || "").trim()
  if (desc) paras.push(desc)

  const fin = String(row["Fin System"] || "").trim()
  if (fin) paras.push("Fin system: " + fin.replace(/\n/g, " / "))

  const color = String(row["Color"] || "").trim()
  if (color) paras.push("Color: " + color.replace(/\n/g, ", "))

  const glass = String(row["Glassing"] || "").trim()
  if (glass) paras.push("Glassing: " + glass)

  const rocker = String(row["Rocker"] || "").trim()
  if (rocker) paras.push("Rocker: " + rocker)

  const concave = String(row["Concave"] || "").trim()
  if (concave) paras.push("Concave: " + concave)

  const rails = String(row["Rails"] || "").trim()
  if (rails) paras.push("Rails: " + rails)

  const tail = String(row["Tail"] || "").trim()
  if (tail) paras.push("Tail: " + tail)

  const fins = String(row["Fins"] || "").trim()
  if (fins) paras.push("Fins: " + fins)

  const how = String(row["How It Surfs"] || "").trim()
  if (how) paras.push("How it surfs: " + how)

  const quiver = String(row["Where It Sits In Your Quiver"] || "").trim()
  if (quiver) paras.push("Quiver: " + quiver)

  const ability = String(row["Ability Level"] || "").trim()
  const waveSize = String(row["Ideal Wave Size"] || "").trim()
  const skillLevelLabels = ability ? [ability] : []
  const waveSizeLabels = waveSize ? [waveSize] : []

  let stockDims = zipStockDims(row)
  if (!stockDims.length) stockDims = []

  const galleryImages = buildGallery(row)
  const marketingImageUrl = firstLineUrl(row["Product Image"])

  detailsBySlug[modelSlug] = {
    brandSlug,
    modelSlug,
    descriptionParagraphs: paras,
    priceUsd: null,
    ...(marketingImageUrl ? { marketingImageUrl } : {}),
    ...(galleryImages.length ? { galleryImages } : {}),
    waveSizeLabels,
    skillLevelLabels,
    stockDims,
  }
}

fs.writeFileSync(path.join(root, "dhd-surfboards.json"), JSON.stringify(brand, null, 2))
fs.writeFileSync(
  path.join(root, "dhd-surfboards-model-details.json"),
  JSON.stringify(detailsBySlug, null, 2),
)

console.log(`Wrote ${models.length} models to dhd-surfboards.json and dhd-surfboards-model-details.json`)
