import { readdirSync, statSync } from "node:fs"
import path from "node:path"
import type { SupabaseClient } from "@supabase/supabase-js"
import { proxiedBlogImageSrc } from "@/lib/blog/blog-media-proxy-url"
import { listAllBlogPostsAdmin, mapBlogRowToArticle } from "@/lib/db/blog-posts"
import type { ArticleBlock } from "@/lib/field-notes-articles"
import { MANAGED_PAGES } from "@/lib/seo/managed-pages"
import { seoMediaDisplaySrc } from "@/lib/seo-media-proxy-url"
import { listStaticSiteAssets } from "@/lib/site-assets/static-registry"
import type { SiteAssetCategory, SiteAssetEntry, SiteAssetsInventory } from "@/lib/types/site-assets"

function countByCategory(assets: SiteAssetEntry[]): Record<SiteAssetCategory, number> {
  const counts: Record<SiteAssetCategory, number> = {
    brand: 0,
    home: 0,
    marketing: 0,
    about: 0,
    sell: 0,
    "help-center": 0,
    email: 0,
    metadata: 0,
    seo: 0,
    blog: 0,
    orphan: 0,
  }
  for (const asset of assets) {
    counts[asset.category] += 1
  }
  return counts
}

function dedupeAssets(assets: SiteAssetEntry[]): SiteAssetEntry[] {
  const byKey = new Map<string, SiteAssetEntry>()
  for (const asset of assets) {
    const key = asset.displaySrc
    const existing = byKey.get(key)
    if (!existing) {
      byKey.set(key, asset)
      continue
    }
    byKey.set(key, {
      ...existing,
      pageUrls: [...new Set([...existing.pageUrls, ...asset.pageUrls])].sort(),
      notes: [existing.notes, asset.notes].filter(Boolean).join(" · ") || undefined,
    })
  }
  return [...byKey.values()].sort((a, b) => {
    const cat = a.category.localeCompare(b.category)
    if (cat !== 0) return cat
    return a.label.localeCompare(b.label)
  })
}

function collectSeoAssets(): SiteAssetEntry[] {
  const out: SiteAssetEntry[] = []
  for (const page of MANAGED_PAGES) {
    const og = page.defaults.ogImageUrl?.trim()
    const twitter = page.defaults.twitterImageUrl?.trim()
    for (const raw of [og, twitter]) {
      if (!raw) continue
      out.push({
        id: `seo:${page.key}:${raw}`,
        label: `${page.label} — share image`,
        displaySrc: seoMediaDisplaySrc(raw),
        category: "seo",
        pageUrls: [page.defaults.path],
        status: "active",
        source: raw.startsWith("http") ? "Supabase seo-assets bucket" : raw,
        notes: "Open Graph / Twitter card — not visible in page body.",
      })
    }
  }
  return out
}

function blogBlockImages(blocks: ArticleBlock[]): { url: string; label: string }[] {
  const images: { url: string; label: string }[] = []
  blocks.forEach((block, index) => {
    if (block.kind === "image" && block.url.trim()) {
      images.push({ url: block.url, label: `Inline image ${index + 1}` })
    }
  })
  return images
}

async function collectBlogAssets(supabase: SupabaseClient): Promise<SiteAssetEntry[]> {
  const rows = await listAllBlogPostsAdmin(supabase)
  const out: SiteAssetEntry[] = []

  for (const row of rows) {
    const article = mapBlogRowToArticle(row)
    const pagePath = `/blog/${article.slug}`
    const listed = article.published && article.listedOnBlog

    const cover = article.coverImage?.trim()
    if (cover) {
      out.push({
        id: `blog:cover:${article.slug}`,
        label: `${article.title} — cover`,
        displaySrc: proxiedBlogImageSrc(cover),
        category: "blog",
        pageUrls: listed ? [pagePath, "/blog"] : [pagePath],
        status: "active",
        source: "Supabase blog-images bucket",
        notes: article.published ? undefined : "Draft / unpublished post.",
      })
    }

    const og = article.ogImage?.trim()
    if (og && og !== cover) {
      out.push({
        id: `blog:og:${article.slug}`,
        label: `${article.title} — OG image`,
        displaySrc: proxiedBlogImageSrc(og),
        category: "blog",
        pageUrls: [pagePath],
        status: "active",
        source: "Supabase blog-images bucket",
        notes: "Social share image only.",
      })
    }

    for (const img of blogBlockImages(article.blocks)) {
      out.push({
        id: `blog:block:${article.slug}:${img.url}`,
        label: `${article.title} — ${img.label}`,
        displaySrc: proxiedBlogImageSrc(img.url),
        category: "blog",
        pageUrls: [pagePath],
        status: "active",
        source: "Supabase blog-images bucket",
      })
    }
  }

  return out
}

/** Walk /public/images and flag files missing from the static registry. */
function collectFilesystemOrphans(registeredPaths: Set<string>): SiteAssetEntry[] {
  const root = path.join(process.cwd(), "public/images")
  const orphans: SiteAssetEntry[] = []

  function walk(dir: string, prefix = ""): void {
    let entries: string[]
    try {
      entries = readdirSync(dir)
    } catch {
      return
    }

    for (const name of entries) {
      const full = path.join(dir, name)
      const rel = prefix ? `${prefix}/${name}` : name
      if (statSync(full).isDirectory()) {
        walk(full, rel)
        continue
      }
      if (!/\.(png|jpe?g|webp|svg|gif)$/i.test(name)) continue
      const publicPath = `/images/${rel}`
      if (registeredPaths.has(publicPath)) continue
      orphans.push({
        id: `orphan:${publicPath}`,
        label: rel,
        displaySrc: publicPath,
        category: "orphan",
        pageUrls: [],
        status: "orphan",
        source: `public/images/${rel}`,
        notes: "On disk but not in the static asset registry.",
      })
    }
  }

  walk(root)
  return orphans
}

export async function buildSiteAssetsInventory(
  supabase: SupabaseClient,
): Promise<SiteAssetsInventory> {
  const staticAssets = listStaticSiteAssets()
  const registeredPaths = new Set(
    staticAssets.filter((a) => a.displaySrc.startsWith("/images/")).map((a) => a.displaySrc),
  )

  const assets = dedupeAssets([
    ...staticAssets,
    ...collectSeoAssets(),
    ...(await collectBlogAssets(supabase)),
    ...collectFilesystemOrphans(registeredPaths),
  ])

  return {
    assets,
    counts: countByCategory(assets),
    generatedAt: new Date().toISOString(),
  }
}
