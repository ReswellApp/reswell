"use client"

import { useMemo, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { ExternalLink, ImageIcon, Search } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import {
  SITE_ASSET_CATEGORY_LABELS,
  type SiteAssetCategory,
  type SiteAssetEntry,
  type SiteAssetsInventory,
} from "@/lib/types/site-assets"

const STATUS_LABELS: Record<SiteAssetEntry["status"], string> = {
  active: "Active",
  orphan: "Unused",
  fallback: "Fallback",
  external: "External",
}

const STATUS_CLASS: Record<SiteAssetEntry["status"], string> = {
  active: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  orphan: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  fallback: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
  external: "bg-violet-500/10 text-violet-700 dark:text-violet-400",
}

interface SiteAssetsClientProps {
  inventory: SiteAssetsInventory
  siteOrigin: string
  generatedAtLabel: string
}

function isExternalSrc(src: string): boolean {
  return /^https?:\/\//i.test(src)
}

function pageHref(origin: string, pagePath: string): string {
  if (pagePath === "*") return origin
  return `${origin}${pagePath}`
}

function AssetCard({ asset, siteOrigin }: { asset: SiteAssetEntry; siteOrigin: string }) {
  const external = isExternalSrc(asset.displaySrc)

  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="relative aspect-[16/10] w-full bg-muted">
        {external ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={asset.displaySrc}
            alt=""
            className="h-full w-full object-cover object-top"
            loading="lazy"
          />
        ) : (
          <Image
            src={asset.displaySrc}
            alt=""
            fill
            className="object-cover object-top"
            sizes="(max-width: 768px) 100vw, 320px"
            unoptimized={asset.displaySrc.endsWith(".svg")}
          />
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex flex-wrap items-start gap-2">
          <h3 className="min-w-0 flex-1 text-sm font-semibold leading-snug text-foreground">
            {asset.label}
          </h3>
          <Badge variant="secondary" className="shrink-0 text-[10px] uppercase tracking-wide">
            {SITE_ASSET_CATEGORY_LABELS[asset.category]}
          </Badge>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <span className={cn("rounded-md px-2 py-0.5 text-[10px] font-medium", STATUS_CLASS[asset.status])}>
            {STATUS_LABELS[asset.status]}
          </span>
        </div>

        <p className="break-all font-mono text-[11px] text-muted-foreground">{asset.displaySrc}</p>
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Source:</span> {asset.source}
        </p>
        {asset.notes ? <p className="text-xs text-muted-foreground">{asset.notes}</p> : null}

        <div className="mt-auto space-y-1.5 border-t border-border pt-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Appears on
          </p>
          {asset.pageUrls.length === 0 ? (
            <p className="text-xs text-muted-foreground">Not linked to a storefront page</p>
          ) : (
            <ul className="space-y-1">
              {asset.pageUrls.map((pagePath) => {
                const href = pageHref(siteOrigin, pagePath)
                const isWildcard = pagePath === "*"
                return (
                  <li key={`${asset.id}:${pagePath}`}>
                    {isWildcard ? (
                      <span className="text-xs text-muted-foreground">All pages (site-wide metadata)</span>
                    ) : (
                      <Link
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium text-listingHeart hover:underline"
                      >
                        {pagePath}
                        <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
                      </Link>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </article>
  )
}

export function SiteAssetsClient({ inventory, siteOrigin, generatedAtLabel }: SiteAssetsClientProps) {
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState<SiteAssetCategory | "all">("all")
  const [status, setStatus] = useState<SiteAssetEntry["status"] | "all">("all")

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return inventory.assets.filter((asset) => {
      if (category !== "all" && asset.category !== category) return false
      if (status !== "all" && asset.status !== status) return false
      if (!q) return true
      const haystack = [
        asset.label,
        asset.displaySrc,
        asset.source,
        asset.notes ?? "",
        asset.pageUrls.join(" "),
        SITE_ASSET_CATEGORY_LABELS[asset.category],
      ]
        .join(" ")
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [inventory.assets, query, category, status])

  const categories = Object.keys(SITE_ASSET_CATEGORY_LABELS) as SiteAssetCategory[]

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total assets</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{inventory.assets.length}</p>
        </div>
        {categories.slice(0, 3).map((cat) => (
          <div key={cat} className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {SITE_ASSET_CATEGORY_LABELS[cat]}
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{inventory.counts[cat]}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative min-w-[220px] flex-1 sm:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search label, path, page URL…"
            className="pl-9"
          />
        </div>
        <Select value={category} onValueChange={(v) => setCategory(v as SiteAssetCategory | "all")}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {SITE_ASSET_CATEGORY_LABELS[cat]} ({inventory.counts[cat]})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => setStatus(v as SiteAssetEntry["status"] | "all")}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {(Object.keys(STATUS_LABELS) as SiteAssetEntry["status"][]).map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <p className="text-xs text-muted-foreground">
        Showing {filtered.length} of {inventory.assets.length} assets · Inventory generated{" "}
        {generatedAtLabel}
      </p>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border py-16 text-muted-foreground">
          <ImageIcon className="h-8 w-8" aria-hidden />
          <p className="text-sm">No assets match your filters.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filtered.map((asset) => (
            <AssetCard key={asset.id} asset={asset} siteOrigin={siteOrigin} />
          ))}
        </div>
      )}
    </div>
  )
}
