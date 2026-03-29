#!/usr/bin/env node
/**
 * Regenerate lib/index-directory/data/roberts-surfboards.json and
 * roberts-surfboards-model-details.json from a Thunderbit JSON export (Roberts Surf catalog).
 *
 * Fields: Surfboard Model Name, Surfboard Model URL, Surfboard Model Image, Surfboard Category,
 * Surfboard Description, Rocker, Rails, Bottom Contour, Fins, Wave Type, Size Guide,
 * How to Size This Board, Similar Models, Video URL.
 *
 * Duplicate rows with the same product URL are skipped (keeps first).
 *
 * Usage: node scripts/import-robertssurf-thunderbit.mjs /path/to/export.json
 */
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, "..", "lib", "index-directory", "data")

const inputPath = process.argv[2]
if (!inputPath || !fs.existsSync(inputPath)) {
  console.error("Usage: node scripts/import-robertssurf-thunderbit.mjs <export.json>")
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

function modelSlugFromUrl(url) {
  try {
    const u = new URL(url)
    let seg = u.pathname.split("/").filter(Boolean).pop() || ""
    seg = seg.replace(/\.html?$/i, "").replace(/\.php$/i, "")
    const s = seg
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
    return s || null
  } catch {
    return null
  }
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

function waveSizeLabelsFromRow(s) {
  const t = String(s || "").trim()
  if (!t) return []
  if (t.length <= 48) return [t]
  const parts = t
    .split(/\.\s+|(?:\s*;\s*)|(?:\s+or\s+)/i)
    .map((x) => x.trim().replace(/\.$/, ""))
    .filter(Boolean)
  return parts.length > 1 ? parts.slice(0, 6) : [t]
}

const seenProductUrls = new Set()
const usedSlugs = new Set()
const rows = []

for (const row of raw) {
  const name = String(row["Surfboard Model Name"] || "").trim()
  if (!name) continue
  const productUrl = String(row["Surfboard Model URL"] || "").trim()
  if (!productUrl) continue
  if (seenProductUrls.has(productUrl)) continue
  seenProductUrls.add(productUrl)

  const base = modelSlugFromUrl(productUrl) || slugify(name)
  const slug = uniqueSlug(base || "model", usedSlugs)
  rows.push({ row, name, slug })
}

const models = rows.map(({ row, name, slug }) => ({
  slug,
  name,
  productUrl: String(row["Surfboard Model URL"] || "").trim(),
  imageUrl: String(row["Surfboard Model Image"] || "").trim(),
  entryRocker: null,
  exitRocker: null,
  rockerStyle: null,
}))

const brand = {
  slug: "roberts-surfboards",
  kind: "brand",
  name: "Roberts Surfboards",
  shortDescription:
    "Pat Roberts’ California shapes — from White Diamond grovelers and Diamond family twins to performance everyday boards trusted from Ventura to worldwide lineups.",
  websiteUrl: "https://www.robertssurf.com",
  logoUrl:
    "https://www.robertssurf.com/uploads/1/0/6/3/10638997/rwsd-logo-footer-148x78-v2_orig.png",
  founderName: "Pat Roberts",
  leadShaperName: "Pat Roberts",
  locationLabel: "Ventura, California",
  aboutParagraphs: [
    "Roberts Surfboards builds versatile shortboards and hybrids from Ventura — known for the White Diamond and a full quiver of small-wave, mid-length, and high-performance templates.",
    "Model pages on Reswell mirror Roberts’ public specs: rocker, rails, bottom contours, fin options, wave ranges, size guides, and sizing notes.",
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

  const cat = String(row["Surfboard Category"] || "").trim()
  if (cat) paras.push(`Category: ${cat}.`)

  const rocker = String(row["Rocker"] || "").trim()
  const rails = String(row["Rails"] || "").trim()
  const bottom = String(row["Bottom Contour"] || "").trim()
  const fins = String(row["Fins"] || "").trim()
  if (rocker) paras.push(`Rocker: ${rocker}`)
  if (rails) paras.push(`Rails: ${rails}`)
  if (bottom) paras.push(`Bottom: ${bottom}`)
  if (fins) paras.push(`Fins: ${fins}`)

  const howSize = String(row["How to Size This Board"] || "").trim()
  if (howSize) {
    paras.push("Sizing:")
    for (const p of howSize.split(/\n\n+/).map((x) => x.trim()).filter(Boolean)) paras.push(p)
  }

  const similar = String(row["Similar Models"] || "").trim()
  if (similar) {
    const lines = similar.split(/\n/).map((l) => l.trim()).filter(Boolean)
    if (lines.length) paras.push(`Related models: ${lines.join(" · ")}`)
  }

  const video = String(row["Video URL"] || "").trim()
  if (video && /^https?:\/\//i.test(video) && !video.includes("robertssurfboards.com")) {
    paras.push(`Video: ${video}`)
  }

  const sizeGuide = String(row["Size Guide"] || "").trim()
  const stockDims = sizeGuide
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => ({ raw: line }))

  const img = String(row["Surfboard Model Image"] || "").trim()
  const galleryImages = img
    ? [{ url: img, caption: "Model" }]
    : []

  detailsBySlug[slug] = {
    brandSlug: "roberts-surfboards",
    modelSlug: slug,
    descriptionParagraphs: paras.length ? paras : ["See Roberts’ site for full model notes."],
    priceUsd: null,
    ...(img ? { marketingImageUrl: img } : {}),
    ...(galleryImages.length ? { galleryImages } : {}),
    waveSizeLabels: waveSizeLabelsFromRow(row["Wave Type"]),
    skillLevelLabels: [],
    stockDims,
  }
}

fs.writeFileSync(path.join(root, "roberts-surfboards.json"), JSON.stringify(brand, null, 2))
fs.writeFileSync(
  path.join(root, "roberts-surfboards-model-details.json"),
  JSON.stringify(detailsBySlug, null, 2),
)
console.log(
  `Wrote ${models.length} models (${raw.length} rows) to roberts-surfboards.json and roberts-surfboards-model-details.json`,
)
