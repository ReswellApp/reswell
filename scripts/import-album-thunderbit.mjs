#!/usr/bin/env node
/**
 * Regenerate lib/index-directory/data/album-surf.json and
 * album-surf-model-details.json from a Thunderbit JSON export.
 *
 * Expects each row to include: Board Model Name, Board Model URL, Board Model Image,
 * Board Description, Concept Details, About the Board, Stock Dimensions, Bottom Contour,
 * Deck/Rocker Profile, optional Images (JSON array string), optional
 * Board Model Image Listing Hover IMage.
 *
 * Usage: node scripts/import-album-thunderbit.mjs /path/to/export.json
 */
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, "..", "lib", "index-directory", "data")

const inputPath = process.argv[2]
if (!inputPath || !fs.existsSync(inputPath)) {
  console.error("Usage: node scripts/import-album-thunderbit.mjs <export.json>")
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

function firstLineUrl(s) {
  const line = String(s || "")
    .split("\n")
    .map((x) => x.trim())
    .find(Boolean)
  return line || ""
}

function parseImagesJson(s) {
  const t = String(s || "").trim()
  if (!t) return []
  try {
    const arr = JSON.parse(t)
    return Array.isArray(arr) ? arr.map((u) => String(u).trim()).filter(Boolean) : []
  } catch {
    return []
  }
}

function urlKey(u) {
  try {
    const x = new URL(u)
    return `${x.host}${x.pathname}`
  } catch {
    return u
  }
}

function buildGallery(row) {
  const primary = firstLineUrl(row["Board Model Image"])
  const hover = String(row["Board Model Image Listing Hover IMage"] || "").trim()
  const extra = parseImagesJson(row["Images"])
  const items = []
  const seen = new Set()

  function push(url, caption) {
    if (!url) return
    const k = urlKey(url)
    if (seen.has(k)) return
    seen.add(k)
    items.push({ url, caption })
  }

  push(primary, "Board")
  if (hover && hover !== primary) push(hover, "Listing")
  let i = 0
  for (const u of extra) {
    i += 1
    push(u, `Photo ${i}`)
  }
  return items
}

const models = raw.map((row) => {
  const name = row["Board Model Name"]
  const slug = slugify(name)
  return {
    slug,
    name,
    productUrl: row["Board Model URL"],
    imageUrl: firstLineUrl(row["Board Model Image"]),
    entryRocker: null,
    exitRocker: null,
    rockerStyle: null,
  }
})

const brand = {
  slug: "album-surf",
  kind: "brand",
  name: "Album Surf",
  shortDescription:
    "Custom boards from Matt Parker — performance twins, asymmetrics, fish, and mid-lengths from San Clemente.",
  websiteUrl: "https://albumsurf.com",
  logoUrl: "https://albumsurf.com/cdn/shop/files/Album-Logo-small_220x.png?v=1613776528",
  founderName: "Matt Parker",
  leadShaperName: "Matt Parker",
  locationLabel: "San Clemente, California",
  aboutParagraphs: [
    "Album Surf is a Southern California surfboard brand known for innovative shapes — from the Twinsman and Plasmic to asymmetrical designs like the Disorder.",
    "Led by shaper Matt Parker, Album builds boards that emphasize speed, flow, and real-world usability, often developed with team riders and collaborators such as Asher Pacey, Victor Bernardo, and Jack Freestone.",
  ],
  models,
}

const detailsBySlug = {}
for (const row of raw) {
  const slug = slugify(row["Board Model Name"])
  const paras = [row["Board Description"], row["Concept Details"], row["About the Board"]]
    .map((s) => String(s || "").trim())
    .filter(Boolean)
  const stockLines = String(row["Stock Dimensions"] || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
  const stockDims = stockLines.map((line) => ({ raw: line }))
  const bottom = String(row["Bottom Contour"] || "").trim()
  const deckRocker = String(row["Deck/Rocker Profile"] || "").trim()
  if (bottom) paras.push("Bottom contour: " + bottom)
  if (deckRocker) paras.push("Deck & rocker: " + deckRocker)

  const galleryImages = buildGallery(row)
  const primaryImage = firstLineUrl(row["Board Model Image"])

  detailsBySlug[slug] = {
    brandSlug: "album-surf",
    modelSlug: slug,
    descriptionParagraphs: paras,
    priceUsd: null,
    ...(primaryImage ? { marketingImageUrl: primaryImage } : {}),
    ...(galleryImages.length ? { galleryImages } : {}),
    waveSizeLabels: [],
    skillLevelLabels: [],
    stockDims,
  }
}

fs.writeFileSync(path.join(root, "album-surf.json"), JSON.stringify(brand, null, 2))
fs.writeFileSync(path.join(root, "album-surf-model-details.json"), JSON.stringify(detailsBySlug, null, 2))
console.log(`Wrote ${models.length} models to album-surf.json and album-surf-model-details.json`)
