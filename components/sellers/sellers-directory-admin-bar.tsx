"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ExternalLink,
  Loader2,
  MapPin,
  Plus,
  Search,
  Store,
  Trash2,
} from "lucide-react"
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
import { getAdminSession } from "@/app/actions/account"
import { VerifiedBadge } from "@/components/verified-badge"
import { cn } from "@/lib/utils"

type DemotedRow = {
  profile_id: string
  created_at: string
  seller_slug: string
  display_name: string | null
  shop_name: string | null
  shop_logo_url: string | null
  avatar_url: string | null
}

type SearchHit = {
  id: string
  seller_slug: string
  display_name: string | null
  shop_name: string | null
  shop_logo_url: string | null
  avatar_url: string | null
  city: string | null
  shop_address: string | null
  shop_verified: boolean
  already_demoted: boolean
}

const SEARCH_DEBOUNCE_MS = 200

function sellerLabel(shopName: string | null | undefined, displayName: string | null | undefined): string {
  return shopName?.trim() || displayName?.trim() || "Seller"
}

function sellerLocation(row: SearchHit): string | null {
  const addr = row.shop_address?.trim()
  if (addr) return addr
  const city = row.city?.trim()
  return city || null
}

/**
 * Admin-only: demote sellers to the bottom of the public `/sellers` directory (ordering only — profiles stay visible).
 */
export function SellersDirectoryAdminBar() {
  const router = useRouter()
  const [isAdmin, setIsAdmin] = React.useState(false)
  const [loaded, setLoaded] = React.useState(false)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [demoted, setDemoted] = React.useState<DemotedRow[]>([])
  const [loadingDemoted, setLoadingDemoted] = React.useState(false)
  const [removingId, setRemovingId] = React.useState<string | null>(null)
  const [addingProfileId, setAddingProfileId] = React.useState<string | null>(null)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [searchHits, setSearchHits] = React.useState<SearchHit[]>([])
  const [searching, setSearching] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    getAdminSession()
      .then((d: { isAdmin?: boolean }) => {
        if (!cancelled) {
          setIsAdmin(d.isAdmin === true)
          setLoaded(true)
        }
      })
      .catch(() => {
        if (!cancelled) setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const loadDemoted = React.useCallback(async () => {
    setLoadingDemoted(true)
    try {
      const res = await fetch("/api/admin/sellers-directory-demotions", { credentials: "include" })
      const json = (await res.json().catch(() => ({}))) as {
        data?: { rows: DemotedRow[] }
        error?: string
      }
      if (!res.ok) {
        toast.error(typeof json.error === "string" ? json.error : "Could not load demoted sellers")
        return
      }
      setDemoted(Array.isArray(json.data?.rows) ? json.data!.rows : [])
    } finally {
      setLoadingDemoted(false)
    }
  }, [])

  const runSearch = React.useCallback(async (q: string) => {
    const term = q.trim()
    if (term.length < 1) {
      setSearchHits([])
      setSearching(false)
      return
    }
    setSearching(true)
    try {
      const params = new URLSearchParams()
      params.set("q", term)
      params.set("limit", "200")
      const res = await fetch(`/api/admin/sellers-directory-demotions/search?${params.toString()}`, {
        credentials: "include",
      })
      const json = (await res.json().catch(() => ({}))) as {
        data?: { hits: SearchHit[] }
        error?: string
      }
      if (!res.ok) {
        toast.error(typeof json.error === "string" ? json.error : "Search failed")
        setSearchHits([])
        return
      }
      setSearchHits(Array.isArray(json.data?.hits) ? json.data!.hits : [])
    } finally {
      setSearching(false)
    }
  }, [])

  React.useEffect(() => {
    if (!dialogOpen) return
    void loadDemoted()
    setSearchQuery("")
    setSearchHits([])
  }, [dialogOpen, loadDemoted])

  React.useEffect(() => {
    if (!dialogOpen) return
    const handle = window.setTimeout(() => {
      void runSearch(searchQuery)
    }, SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(handle)
  }, [dialogOpen, searchQuery, runSearch])

  async function onAdd(profileId: string) {
    setAddingProfileId(profileId)
    try {
      const res = await fetch("/api/admin/sellers-directory-demotions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ profile_id: profileId }),
      })
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        toast.error(typeof json.error === "string" ? json.error : "Could not demote seller")
        return
      }
      setSearchHits((prev) =>
        prev.map((h) => (h.id === profileId ? { ...h, already_demoted: true } : h)),
      )
      await loadDemoted()
      router.refresh()
      toast.success("Seller moved to bottom of directory")
    } finally {
      setAddingProfileId(null)
    }
  }

  async function onRemove(profileId: string) {
    setRemovingId(profileId)
    try {
      const res = await fetch(`/api/admin/sellers-directory-demotions/${encodeURIComponent(profileId)}`, {
        method: "DELETE",
        credentials: "include",
      })
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        toast.error(typeof json.error === "string" ? json.error : "Could not restore seller rank")
        return
      }
      toast.success("Seller rank restored")
      setDemoted((prev) => prev.filter((r) => r.profile_id !== profileId))
      setSearchHits((prev) => prev.map((h) => (h.id === profileId ? { ...h, already_demoted: false } : h)))
      router.refresh()
    } finally {
      setRemovingId(null)
    }
  }

  if (!loaded || !isAdmin) return null

  return (
    <>
      <Button
        type="button"
        size="icon"
        variant="default"
        className="h-10 w-10 shrink-0 rounded-full shadow-soft"
        onClick={() => setDialogOpen(true)}
        aria-label="Demote sellers in directory"
      >
        <Plus className="h-5 w-5" />
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          className={cn(
            "flex h-[min(90dvh,800px)] w-[min(100%,calc(100vw-1.5rem))] min-w-0 max-w-xl flex-col gap-0 overflow-hidden p-0 sm:max-w-xl",
          )}
        >
          <div className="min-w-0 shrink-0 space-y-1.5 border-b border-border/80 p-4 pb-3 pr-10 sm:px-6 sm:pt-5">
            <DialogHeader className="p-0 text-left sm:text-left">
              <DialogTitle>Sellers directory — demote to bottom</DialogTitle>
              <DialogDescription className="text-pretty [overflow-wrap:anywhere]">
                Demoted sellers stay on the directory but sort after everyone else (same tie-breakers within the
                demoted group as they were added). Shoppers and URLs are unchanged.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-0 p-4 pt-3 sm:px-6 sm:pb-4">
            <div className="mb-3 flex min-h-0 min-w-0 shrink-0 flex-col gap-1.5">
              <h3 className="text-sm font-semibold text-foreground">Demoted ({demoted.length})</h3>
              {loadingDemoted ? (
                <div className="flex min-h-[5rem] justify-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : demoted.length === 0 ? (
                <p className="rounded-md border border-dashed border-border/80 bg-muted/20 px-3 py-4 text-center text-xs text-muted-foreground">
                  No sellers demoted. Everyone follows normal directory ranking (sales, verified, recency).
                </p>
              ) : (
                <div
                  className="max-h-[32vh] min-h-0 min-w-0 overflow-y-auto overflow-x-hidden overscroll-y-contain rounded-md [scrollbar-gutter:stable]"
                  data-scroll-region="sellers-demoted"
                >
                  <ul className="min-w-0 space-y-2 pr-1">
                    {demoted.map((row) => {
                      const label = sellerLabel(row.shop_name, row.display_name)
                      const avatar = row.shop_logo_url || row.avatar_url || null
                      return (
                        <li
                          key={row.profile_id}
                          className="flex w-full min-w-0 max-w-full items-center gap-2 rounded-lg border border-border/80 bg-muted/20 p-2 sm:gap-3"
                        >
                          {avatar ? (
                            <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border border-border/50 bg-background">
                              <Image
                                src={avatar}
                                alt=""
                                fill
                                sizes="48px"
                                className="object-cover"
                                unoptimized={avatar.startsWith("/")}
                              />
                            </span>
                          ) : (
                            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-border/50 bg-muted text-sm font-semibold text-cerulean">
                              {label.slice(0, 1).toUpperCase()}
                            </span>
                          )}
                          <div className="min-w-0 flex-1 overflow-hidden">
                            <Link
                              href={`/sellers/${encodeURIComponent(row.seller_slug)}`}
                              target="_blank"
                              rel="noreferrer"
                              className="group flex min-w-0 max-w-full items-start gap-1.5 text-sm font-medium text-foreground hover:text-foreground/80"
                              title={label}
                            >
                              <span className="line-clamp-2 min-w-0 break-words [overflow-wrap:anywhere]">
                                {label}
                              </span>
                              <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground/80" />
                            </Link>
                          </div>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-9 w-9 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            disabled={removingId === row.profile_id}
                            onClick={() => void onRemove(row.profile_id)}
                            aria-label={`Restore rank for ${label}`}
                          >
                            {removingId === row.profile_id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}
            </div>

            <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
              <h3 className="shrink-0 text-sm font-semibold text-foreground">Demote a seller</h3>
              <div className="relative w-full min-w-0 max-w-full shrink-0">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by shop, name, slug, or city…"
                  className="w-full min-w-0 pl-9"
                  aria-label="Search sellers to demote"
                />
              </div>
              <div
                className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain rounded-md border border-border/50 bg-muted/5 [scrollbar-gutter:stable]"
                data-scroll-region="sellers-demote-search"
              >
                {searchQuery.trim().length < 1 ? (
                  <p className="px-2 py-8 text-center text-xs text-muted-foreground sm:px-3 sm:py-10">
                    Type at least one character to search the seller directory.
                  </p>
                ) : searching && searchHits.length === 0 ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : searchHits.length === 0 ? (
                  <p className="px-2 py-8 text-center text-xs text-muted-foreground sm:px-3 sm:py-10">
                    No sellers match that search.
                  </p>
                ) : (
                  <ul className="min-w-0 space-y-2 p-2 pr-1 sm:p-2.5">
                    {searchHits.map((hit) => {
                      const label = sellerLabel(hit.shop_name, hit.display_name)
                      const loc = sellerLocation(hit)
                      const avatar = hit.shop_logo_url || hit.avatar_url || null
                      return (
                        <li
                          key={hit.id}
                          className="flex w-full min-w-0 max-w-full items-center gap-2 rounded-lg border border-border/80 bg-muted/20 p-2 sm:gap-3"
                        >
                          {avatar ? (
                            <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border border-border/50 bg-background">
                              <Image
                                src={avatar}
                                alt=""
                                fill
                                sizes="48px"
                                className="object-cover"
                                unoptimized={avatar.startsWith("/")}
                              />
                            </span>
                          ) : (
                            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-border/50 bg-muted text-sm font-semibold text-cerulean">
                              {label.slice(0, 1).toUpperCase()}
                            </span>
                          )}
                          <div className="min-w-0 flex-1 overflow-hidden">
                            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                              <Link
                                href={`/sellers/${encodeURIComponent(hit.seller_slug)}`}
                                target="_blank"
                                rel="noreferrer"
                                className="group flex min-w-0 max-w-full items-start gap-1.5 text-sm font-medium text-foreground hover:text-foreground/80"
                                title={label}
                              >
                                <span className="line-clamp-2 min-w-0 break-words [overflow-wrap:anywhere]">
                                  {label}
                                </span>
                                {hit.shop_verified ? <VerifiedBadge size="sm" /> : null}
                                <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground/80" />
                              </Link>
                            </div>
                            {loc ? (
                              <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                                <MapPin className="h-3 w-3 shrink-0" aria-hidden />
                                <span className="truncate">{loc}</span>
                              </p>
                            ) : null}
                          </div>
                          <div className="flex shrink-0 items-center gap-1 self-center">
                            {hit.already_demoted ? (
                              <span className="shrink-0 rounded-md bg-muted px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                Demoted
                              </span>
                            ) : (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={addingProfileId === hit.id}
                                onClick={() => void onAdd(hit.id)}
                                className="shrink-0"
                              >
                                {addingProfileId === hit.id ? (
                                  <>
                                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                    Saving…
                                  </>
                                ) : (
                                  <>
                                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                                    Demote
                                  </>
                                )}
                              </Button>
                            )}
                            <Store className="h-4 w-4 shrink-0 text-muted-foreground/80" aria-hidden />
                          </div>
                        </li>
                      )
                    })}
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
