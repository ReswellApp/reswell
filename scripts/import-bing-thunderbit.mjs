#!/usr/bin/env node
/**
 * Regenerate lib/index-directory/data/bing-surfboards.json and
 * bing-surfboards-model-details.json from a Thunderbit JSON export (Bing catalog).
 *
 * Expected fields per row: Model Name, Model URL, Model Image, Description,
 * Available Sizes, Board Questions Link, Custom Order Link,
 * Surfboard Shipping Rates Link, Retail Price (USD).
 *
 * Usage: node scripts/import-bing-thunderbit.mjs /path/to/export.json
 */
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, "..", "lib", "index-directory", "data")

const inputPath = process.argv[2]
if (!inputPath || !fs.existsSync(inputPath)) {
  console.error("Usage: node scripts/import-bing-thunderbit.mjs <export.json>")
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

function parsePriceUsd(s) {
  const t = String(s || "").trim().replace(/,/g, "")
  if (!t) return null
  const n = Number.parseFloat(t)
  return Number.isFinite(n) ? Math.round(n) : null
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

const usedSlugs = new Set()
const rows = []

for (const row of raw) {
  const name = String(row["Model Name"] || "").trim()
  if (!name) continue
  const base = slugify(name)
  const slug = uniqueSlug(base || "model", usedSlugs)
  rows.push({ row, name, slug })
}

const models = rows.map(({ row, name, slug }) => ({
  slug,
  name,
  productUrl: String(row["Model URL"] || "").trim(),
  imageUrl: firstLineUrl(row["Model Image"]),
  entryRocker: null,
  exitRocker: null,
  rockerStyle: null,
}))

const brand = {
  slug: "bing-surfboards",
  kind: "brand",
  name: "Bing Surfboards",
  shortDescription:
    "Classic California longboards and noseriders from Encinitas — shaped by Matt Calvani with decades of Bing heritage.",
  websiteUrl: "https://bingsurf.com",
  logoUrl:
    "https://bingsurf.com/cdn/shop/files/bing-surfboards-logo_87cc03af-4e3f-4034-a036-03fb3a23dcca_1200x1200.png?v=1613158442",
  founderName: "Bing Copeland",
  leadShaperName: "Matt Calvani",
  locationLabel: "Encinitas, California",
  aboutParagraphs: [
    "Bing Surfboards is one of California’s most storied longboard labels, known for noseriders like the Continental, versatile logs, and refined outlines rooted in Malibu and North County shaping tradition.",
    "Today’s Bing lineup — developed with shaper Matt Calvani — spans classic noseriders, pig-inspired models, and performance-oriented longboards, with detailed stock sizing and custom options direct from the factory.",
  ],
  models,
}

const detailsBySlug = {}

for (const { row, slug } of rows) {
  const desc = String(row["Description"] || "").trim()
  const paras = desc
    ? desc
        .split(/\n\n+/)
        .map((p) => p.trim().replace(/\n/g, " "))
        .filter(Boolean)
    : []

  const sizeBlock = String(row["Available Sizes"] || "").trim()
  const stockLines = sizeBlock
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
  const stockDims = stockLines.map((line) => ({ raw: line }))

  const bq = String(row["Board Questions Link"] || "").trim()
  const co = String(row["Custom Order Link"] || "").trim()
  const ship = String(row["Surfboard Shipping Rates Link"] || "").trim()
  const linkBits = []
  if (bq) linkBits.push(`Board questions: ${bq}`)
  if (co) linkBits.push(`Custom order: ${co}`)
  if (ship) linkBits.push(`Shipping rates: ${ship}`)
  if (linkBits.length) paras.push(linkBits.join(" · "))

  const primaryImage = firstLineUrl(row["Model Image"])
  const priceUsd = parsePriceUsd(row["Retail Price (USD)"])

  detailsBySlug[slug] = {
    brandSlug: "bing-surfboards",
    modelSlug: slug,
    descriptionParagraphs: paras,
    priceUsd,
    ...(primaryImage ? { marketingImageUrl: primaryImage } : {}),
    ...(primaryImage ? { galleryImages: [{ url: primaryImage, caption: "Model" }] } : {}),
    waveSizeLabels: [],
    skillLevelLabels: [],
    stockDims,
  }
}

fs.writeFileSync(path.join(root, "bing-surfboards.json"), JSON.stringify(brand, null, 2))
fs.writeFileSync(
  path.join(root, "bing-surfboards-model-details.json"),
  JSON.stringify(detailsBySlug, null, 2),
)
console.log(`Wrote ${models.length} models to bing-surfboards.json and bing-surfboards-model-details.json`)
