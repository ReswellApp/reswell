#!/usr/bin/env node
/**
 * Regenerate lib/index-directory/data/pyzel-surfboards.json and
 * pyzel-surfboards-model-details.json from a Thunderbit JSON export (Pyzel catalog).
 *
 * Fields: Surfboard Model Name, Surfboard Model URL, Model Family, Model Image,
 * Surfboard Description, Surfboard Specs, Concave Specs, Standard Dimensions,
 * XL Dimensions, Pro Dimensions, Volume Calculator Description.
 * "All images" (JSON array string) is merged into gallery after Model Image URLs, deduped.
 *
 * Usage: node scripts/import-pyzel-thunderbit.mjs /path/to/export.json
 */
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, "..", "lib", "index-directory", "data")

const inputPath = process.argv[2]
if (!inputPath || !fs.existsSync(inputPath)) {
  console.error("Usage: node scripts/import-pyzel-thunderbit.mjs <export.json>")
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

function modelSlugFromRow(row) {
  const url = String(row["Surfboard Model URL"] || "").trim()
  try {
    const u = new URL(url)
    const seg = u.pathname.split("/").filter(Boolean).pop()
    if (seg) return seg
  } catch {
    /* fall through */
  }
  return slugify(String(row["Surfboard Model Name"] || "").trim() || "model")
}

function parseImageUrls(s) {
  return String(s || "")
    .split("\n")
    .map((line) => line.trim().replace(/&amp;/g, "&"))
    .filter(Boolean)
}

function parseAllImagesJson(s) {
  const t = String(s || "").trim()
  if (!t) return []
  try {
    const arr = JSON.parse(t)
    if (!Array.isArray(arr)) return []
    return arr.map((u) => String(u).trim().replace(/&amp;/g, "&")).filter(Boolean)
  } catch {
    return []
  }
}

/** Dedupe same file / different query params (e.g. width=) */
function galleryUrlKey(u) {
  try {
    const x = new URL(u)
    return `${x.host}${x.pathname}`.toLowerCase()
  } catch {
    return u.toLowerCase()
  }
}

function buildPyzelGallery(row) {
  const modelUrls = parseImageUrls(row["Model Image"])
  const extraUrls = parseAllImagesJson(row["All images"])
  const seen = new Set()
  const items = []

  function push(url) {
    if (!url) return
    const k = galleryUrlKey(url)
    if (seen.has(k)) return
    seen.add(k)
    items.push(url)
  }

  for (const url of modelUrls) push(url)
  for (const url of extraUrls) push(url)

  return items.map((url, i) => ({
    url,
    caption: i === 0 ? "Model" : `Photo ${i + 1}`,
  }))
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

function appendDimBlock(stockDims, label, block) {
  const lines = String(block || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
  if (!lines.length) return
  stockDims.push({ raw: `— ${label} —` })
  for (const line of lines) stockDims.push({ raw: line })
}

const usedSlugs = new Set()
const rows = []

for (const row of raw) {
  const name = String(row["Surfboard Model Name"] || "").trim()
  if (!name) continue
  const productUrl = String(row["Surfboard Model URL"] || "").trim()
  const base = modelSlugFromRow(row)
  /** Skip site tools / hub / category pages, not real board models */
  if (
    base === "all-pyzel-models" ||
    /board builder/i.test(name) ||
    /\/all-pyzel-models\/?$/i.test(productUrl) ||
    /\/pages\/model-category\//i.test(productUrl)
  ) {
    continue
  }
  const slug = uniqueSlug(base || slugify(name), usedSlugs)
  rows.push({ row, name, slug })
}

const models = rows.map(({ row, name, slug }) => ({
  slug,
  name,
  productUrl: String(row["Surfboard Model URL"] || "").trim(),
  imageUrl: parseImageUrls(row["Model Image"])[0] || "",
  entryRocker: null,
  exitRocker: null,
  rockerStyle: null,
}))

const brand = {
  slug: "pyzel-surfboards",
  kind: "brand",
  name: "Pyzel Surfboards",
  shortDescription:
    "North Shore performance surfboards from Jon Pyzel — longtime shaper for John John Florence and a global staple in high-performance shortboards and step-ups.",
  websiteUrl: "https://pyzelsurfboards.com",
  logoUrl: "https://pyzelsurfboards.com/cdn/shop/files/logo_1.png?v=1708989668",
  founderName: "Jon Pyzel",
  leadShaperName: "Jon Pyzel",
  locationLabel: "Waialua, Hawaii",
  aboutParagraphs: [
    "Pyzel Surfboards builds high-performance boards on Oahu’s North Shore, blending contest-driven refinement with shapes that work in everything from everyday beach breaks to heavy water.",
    "Best known for models like the Ghost, Phantom, and Shadow alongside team-driven R&D with John John Florence, Pyzel offers detailed stock dimension tables across standard, XL, and pro sizing.",
  ],
  models,
}

const detailsBySlug = {}

for (const { row, slug, name } of rows) {
  const desc = String(row["Surfboard Description"] || "").trim()
  const paras = desc
    ? desc
        .split(/\n\n+/)
        .map((p) => p.trim().replace(/\n/g, " "))
        .filter(Boolean)
    : []

  const family = String(row["Model Family"] || "").trim()
  const specs = String(row["Surfboard Specs"] || "").trim()
  const concave = String(row["Concave Specs"] || "").trim()
  if (family) paras.push(`Model family: ${family}.`)
  if (specs) paras.push(`Fin & wave range: ${specs}.`)
  if (concave) paras.push(`Bottom: ${concave.replace(/\|/g, " · ")}.`)

  const volGuide = String(row["Volume Calculator Description"] || "").trim()
  if (volGuide) {
    const volParas = volGuide
      .split(/\n\n+/)
      .map((p) => p.trim().replace(/\n/g, " "))
      .filter(Boolean)
    if (volParas.length) {
      paras.push("Volume guide:")
      for (const p of volParas) paras.push(p)
    }
  }

  const stockDims = []
  appendDimBlock(stockDims, "Standard dimensions", row["Standard Dimensions"])
  appendDimBlock(stockDims, "XL dimensions", row["XL Dimensions"])
  appendDimBlock(stockDims, "Pro dimensions", row["Pro Dimensions"])

  const galleryImages = buildPyzelGallery(row)
  const primaryImage = galleryImages[0]?.url || parseImageUrls(row["Model Image"])[0] || ""

  detailsBySlug[slug] = {
    brandSlug: "pyzel-surfboards",
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

fs.writeFileSync(path.join(root, "pyzel-surfboards.json"), JSON.stringify(brand, null, 2))
fs.writeFileSync(
  path.join(root, "pyzel-surfboards-model-details.json"),
  JSON.stringify(detailsBySlug, null, 2),
)
console.log(`Wrote ${models.length} models to pyzel-surfboards.json and pyzel-surfboards-model-details.json`)
