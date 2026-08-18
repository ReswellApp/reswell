/**
 * Rasterises the generated ad SVGs to Meta-ready JPGs.
 *
 * The SVGs contain only vector paths, rects, and gradients (all type is already
 * outlined by build_ad_svgs.py), so rendering is font-independent.
 *
 * Usage: node marketing/meta-ads/svg-to-jpg.mjs <svg-dir> <out-dir>
 */

import { readdirSync, readFileSync, mkdirSync } from "node:fs"
import path from "node:path"
import sharp from "sharp"

const [svgDir, outDir] = process.argv.slice(2)
if (!svgDir || !outDir) {
  console.error("usage: node svg-to-jpg.mjs <svg-dir> <out-dir>")
  process.exit(1)
}

mkdirSync(outDir, { recursive: true })

const files = readdirSync(svgDir)
  .filter((name) => name.endsWith(".svg"))
  .sort()

for (const file of files) {
  const target = path.join(outDir, file.replace(/\.svg$/, ".jpg"))
  await sharp(readFileSync(path.join(svgDir, file)), { density: 72 })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 92, chromaSubsampling: "4:4:4", mozjpeg: true })
    .toFile(target)
  console.log(`✓ ${path.basename(target)}`)
}

console.log(`\n${files.length} JPGs written to ${outDir}`)
