export type SiteAssetCategory =
  | "brand"
  | "home"
  | "marketing"
  | "about"
  | "sell"
  | "help-center"
  | "email"
  | "metadata"
  | "seo"
  | "blog"
  | "orphan"

export type SiteAssetStatus = "active" | "orphan" | "fallback" | "external"

export interface SiteAssetEntry {
  id: string
  label: string
  /** Path or URL used in `<img src>` (same-origin paths start with `/`). */
  displaySrc: string
  category: SiteAssetCategory
  /** Storefront paths where this asset appears (or is referenced). */
  pageUrls: string[]
  status: SiteAssetStatus
  /** Repo path, CMS bucket, or external host. */
  source: string
  notes?: string
}

export interface SiteAssetsInventory {
  assets: SiteAssetEntry[]
  counts: Record<SiteAssetCategory, number>
  generatedAt: string
}

export const SITE_ASSET_CATEGORY_LABELS: Record<SiteAssetCategory, string> = {
  brand: "Brand & identity",
  home: "Homepage",
  marketing: "Marketing",
  about: "About",
  sell: "Sell flow",
  "help-center": "Help center",
  email: "Email",
  metadata: "App metadata",
  seo: "SEO / social share",
  blog: "Blog (CMS)",
  orphan: "Unused / orphan",
}
