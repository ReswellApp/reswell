"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ExternalLink, Loader2, Package, Plus, Search, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { BRANDS_BASE } from "@/lib/brands/routes"
import { cn } from "@/lib/utils"

type CuratedRow = {
  id: string
  brand_id: string
  sort_order: number
  brand: { id: string; slug: string; name: string; logo_url: string | null }
}

type SearchHit = {
  id: string
  slug: string
  name: string
  logo_url: string | null
  already_featured: boolean
}

const plusButtonClass =
  "h-9 w-9 shrink-0 rounded-full border border-border/80 bg-background text-foreground shadow-sm hover:bg-muted"

const SEARCH_DEBOUNCE_MS = 200

/**
 * Admin-only: pick which brands from the directory appear in the homepage “Trending brands” strip.
 */
export function HomeTrendingBrandsAdminBar({ isAdmin }: { isAdmin: boolean }) {
  const router = useRouter()
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [curated, setCurated] = React.useState<CuratedRow[]>([])
  const [loadingCurated, setLoadingCurated] = React.useState(false)
  const [deletingId, setDeletingId] = React.useState<string | null>(null)
  const [addingBrandId, setAddingBrandId] = React.useState<string | null>(null)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [searchHits, setSearchHits] = React.useState<SearchHit[]>([])
  const [searching, setSearching] = React.useState(false)

  const loadCurated = React.useCallback(async () => {
    setLoadingCurated(true)
    try {
      const res = await fetch("/api/admin/home-trending-brands", { credentials: "include" })
      const json = (await res.json().catch(() => ({}))) as {
        data?: { rows: CuratedRow[] }
        error?: string
      }
      if (!res.ok) {
        toast.error(typeof json.error === "string" ? json.error : "Could not load trending brands")
        return
      }
      setCurated(Array.isArray(json.data?.rows) ? json.data!.rows : [])
    } finally {
      setLoadingCurated(false)
    }
  }, [])

  const runSearch = React.useCallback(async (q: string) => {
    setSearching(true)
    try {
      const params = new URLSearchParams()
      if (q.trim()) {
        params.set("q", q.trim())
        params.set("limit", "500")
      }
      const res = await fetch(`/api/admin/home-trending-brands/search?${params.toString()}`, {
        credentials: "include",
      })
      const json = (await res.json().catch(() => ({}))) as {
        data?: { hits: SearchHit[] }
        error?: string
      }
      if (!res.ok) {
        toast.error(typeof json.error === "string" ? json.error : "Search failed")
        return
      }
      setSearchHits(Array.isArray(json.data?.hits) ? json.data!.hits : [])
    } finally {
      setSearching(false)
    }
  }, [])

  React.useEffect(() => {
    if (!dialogOpen) return
    void loadCurated()
    void runSearch("")
  }, [dialogOpen, loadCurated, runSearch])

  React.useEffect(() => {
    if (!dialogOpen) return
    const handle = window.setTimeout(() => {
      void runSearch(searchQuery)
    }, SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(handle)
  }, [dialogOpen, searchQuery, runSearch])

  async function onAdd(brandId: string) {
    setAddingBrandId(brandId)
    try {
      const res = await fetch("/api/admin/home-trending-brands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ brand_id: brandId }),
      })
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        toast.error(typeof json.error === "string" ? json.error : "Could not add brand")
        return
      }
      setSearchHits((prev) => prev.map((h) => (h.id === brandId ? { ...h, already_featured: true } : h)))
      await loadCurated()
      router.refresh()
    } finally {
      setAddingBrandId(null)
    }
  }

  async function onRemove(rowId: string, brandId: string) {
    setDeletingId(rowId)
    try {
      const res = await fetch(`/api/admin/home-trending-brands/${encodeURIComponent(rowId)}`, {
        method: "DELETE",
        credentials: "include",
      })
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        toast.error(typeof json.error === "string" ? json.error : "Could not remove brand")
        return
      }
      toast.success("Brand removed")
      setCurated((prev) => prev.filter((r) => r.id !== rowId))
      setSearchHits((prev) => prev.map((h) => (h.id === brandId ? { ...h, already_featured: false } : h)))
      router.refresh()
    } finally {
      setDeletingId(null)
    }
  }

  if (!isAdmin) return null

  return (
    <>
      <Button
        type="button"
        size="icon"
        variant="outline"
        className={plusButtonClass}
        onClick={() => setDialogOpen(true)}
        aria-label="Edit trending brands on homepage"
      >
        <Plus className="h-4 w-4" />
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          className={cn(
            "flex h-[min(90dvh,800px)] w-[min(100%,calc(100vw-1.5rem))] min-w-0 max-w-xl flex-col gap-0 overflow-hidden p-0 sm:max-w-xl",
          )}
        >
          <div className="min-w-0 shrink-0 space-y-1.5 border-b border-border/80 p-4 pb-3 pr-10 sm:px-6 sm:pt-5">
            <DialogHeader className="p-0 text-left sm:text-left">
              <DialogTitle>Homepage — Trending brands</DialogTitle>
              <DialogDescription className="text-pretty [overflow-wrap:anywhere]">
                Choose which brands from the brand directory show in the &ldquo;Trending brands&rdquo; block.
                The strip shows each brand&rsquo;s logo and name only, linked to the brand profile.
                Leave the search field empty to scroll the full brand directory.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-0 p-4 pt-3 sm:px-6 sm:pb-4">
            <div className="mb-3 flex min-h-0 min-w-0 shrink-0 flex-col gap-1.5">
              <h3 className="text-sm font-semibold text-foreground">Selected ({curated.length})</h3>
              {loadingCurated ? (
                <div className="flex min-h-[5rem] justify-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : curated.length === 0 ? (
                <p className="rounded-md border border-dashed border-border/80 bg-muted/20 px-3 py-4 text-center text-xs text-muted-foreground">
                  No brands selected. The home page strip is hidden to shoppers until you add at least one
                  brand.
                </p>
              ) : (
                <div
                  className="max-h-[32vh] min-h-0 min-w-0 overflow-y-auto overflow-x-hidden overscroll-y-contain rounded-md [scrollbar-gutter:stable]"
                  data-scroll-region="trending-selected"
                >
                  <ul className="min-w-0 space-y-2 pr-1">
                    {curated.map((row) => (
                      <BrandPickerRow
                        key={row.id}
                        name={row.brand.name}
                        imageUrl={row.brand.logo_url}
                        href={`${BRANDS_BASE}/${row.brand.slug}`}
                        action={
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-9 w-9 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            disabled={deletingId === row.id}
                            onClick={() => void onRemove(row.id, row.brand_id)}
                            aria-label={`Remove ${row.brand.name}`}
                          >
                            {deletingId === row.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        }
                      />
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
              <h3 className="shrink-0 text-sm font-semibold text-foreground">Add a brand</h3>
              <div className="relative w-full min-w-0 max-w-full shrink-0">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search the brand directory (empty = show all brands)…"
                  className="w-full min-w-0 pl-9"
                  aria-label="Search brands"
                />
              </div>
              <div
                className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain rounded-md border border-border/50 bg-muted/5 [scrollbar-gutter:stable]"
                data-scroll-region="trending-browse"
              >
                {searching && searchHits.length === 0 ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : searchHits.length === 0 ? (
                  <p className="px-2 py-8 text-center text-xs text-muted-foreground sm:px-3 sm:py-10">
                    {searchQuery.trim() ? "No brands match that search." : "No brands in the directory yet."}
                  </p>
                ) : (
                  <ul className="min-w-0 space-y-2 p-2 pr-1 sm:p-2.5">
                    {searchHits.map((hit) => (
                      <BrandPickerRow
                        key={hit.id}
                        name={hit.name}
                        imageUrl={hit.logo_url}
                        href={`${BRANDS_BASE}/${hit.slug}`}
                        action={
                          hit.already_featured ? (
                            <span className="shrink-0 rounded-md bg-muted px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                              Selected
                            </span>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={addingBrandId === hit.id}
                              onClick={() => void onAdd(hit.id)}
                              className="shrink-0"
                            >
                              {addingBrandId === hit.id ? (
                                <>
                                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                  Adding…
                                </>
                              ) : (
                                <>
                                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                                  Add
                                </>
                              )}
                            </Button>
                          )
                        }
                      />
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function BrandPickerRow({
  name,
  imageUrl,
  href,
  action,
}: {
  name: string
  imageUrl: string | null
  href: string
  action: React.ReactNode
}) {
  return (
    <li className="flex w-full min-w-0 max-w-full items-center gap-2 rounded-lg border border-border/80 bg-muted/20 p-2 sm:gap-3">
      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md border border-border/50 bg-background p-1">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt=""
            fill
            sizes="48px"
            className="object-contain p-0.5"
            unoptimized={imageUrl.startsWith("/")}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <Package className="h-5 w-5" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1 overflow-hidden">
        <Link
          href={href}
          target="_blank"
          rel="noreferrer"
          className="group flex min-w-0 max-w-full items-start gap-1.5 text-sm font-medium text-foreground hover:text-foreground/80"
          title={name}
        >
          <span className="line-clamp-2 min-w-0 break-words [overflow-wrap:anywhere]">{name}</span>
          <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground/80" />
        </Link>
      </div>
      <div className="shrink-0 self-center">{action}</div>
    </li>
  )
}
