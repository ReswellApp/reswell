"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import {
  ChevronDown,
  ChevronUp,
  ChevronsUp,
  Copy,
  ExternalLink,
  Loader2,
  Plus,
  Search,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { listingDetailHref } from "@/lib/listing-href"

type EmbedSummary = {
  id: string
  slug: string
  name: string
  partner_label: string | null
  is_active: boolean
}

type EmbedDetail = EmbedSummary & {
  headline: string
  subheadline: string
  cta_primary: string
  cta_secondary: string
}

type CurationRow = {
  id: string
  listing_id: string
  sort_order: number
  listing: {
    id: string
    slug: string
    title: string
    price: number
    status: string | null
    hidden_from_site: boolean | null
    primary_image_url: string | null
  }
}

type SearchHit = {
  id: string
  slug: string
  title: string
  primary_image_url: string | null
  status: string | null
  hidden_from_site: boolean | null
  already_curated: boolean
}

const SEARCH_DEBOUNCE_MS = 200
const INVENTORY_PAGE_SIZE = 40

export function PartnerEmbedsAdminPanel() {
  const [embeds, setEmbeds] = React.useState<EmbedSummary[]>([])
  const [loadingEmbeds, setLoadingEmbeds] = React.useState(true)
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [detail, setDetail] = React.useState<EmbedDetail | null>(null)
  const [rows, setRows] = React.useState<CurationRow[]>([])
  const [embedSnippet, setEmbedSnippet] = React.useState("")
  const [embedUrl, setEmbedUrl] = React.useState("")
  const [embedPath, setEmbedPath] = React.useState("")
  const [jsonFeedUrl, setJsonFeedUrl] = React.useState("")
  const [loadingDetail, setLoadingDetail] = React.useState(false)
  const [creating, setCreating] = React.useState(false)
  const [newName, setNewName] = React.useState("")
  const [savingMeta, setSavingMeta] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [searchHits, setSearchHits] = React.useState<SearchHit[]>([])
  const [searching, setSearching] = React.useState(false)
  const [addingListingId, setAddingListingId] = React.useState<string | null>(null)
  const [deletingRowId, setDeletingRowId] = React.useState<string | null>(null)
  const [reordering, setReordering] = React.useState(false)

  const [headline, setHeadline] = React.useState("")
  const [subheadline, setSubheadline] = React.useState("")
  const [ctaPrimary, setCtaPrimary] = React.useState("")
  const [ctaSecondary, setCtaSecondary] = React.useState("")
  const [partnerLabel, setPartnerLabel] = React.useState("")
  const [isActive, setIsActive] = React.useState(true)

  const loadEmbeds = React.useCallback(async () => {
    setLoadingEmbeds(true)
    try {
      const res = await fetch("/api/admin/partner-embeds", { credentials: "include" })
      const json = (await res.json().catch(() => ({}))) as { data?: { embeds: EmbedSummary[] }; error?: string }
      if (!res.ok) {
        toast.error(typeof json.error === "string" ? json.error : "Could not load embeds")
        return
      }
      const list = Array.isArray(json.data?.embeds) ? json.data!.embeds : []
      setEmbeds(list)
      setSelectedId((prev) => prev ?? list[0]?.id ?? null)
    } finally {
      setLoadingEmbeds(false)
    }
  }, [])

  const loadDetail = React.useCallback(async (embedId: string) => {
    setLoadingDetail(true)
    try {
      const res = await fetch(`/api/admin/partner-embeds/${encodeURIComponent(embedId)}`, {
        credentials: "include",
      })
      const json = (await res.json().catch(() => ({}))) as {
        data?: {
          embed: EmbedDetail
          rows: CurationRow[]
          embed_snippet: string
          embed_url: string
          embed_path: string
          json_feed_url: string
        }
        error?: string
      }
      if (!res.ok) {
        toast.error(typeof json.error === "string" ? json.error : "Could not load embed")
        return
      }
      const embed = json.data?.embed
      if (!embed) return
      setDetail(embed)
      setRows(Array.isArray(json.data?.rows) ? json.data!.rows : [])
      setEmbedSnippet(json.data?.embed_snippet ?? "")
      setEmbedUrl(json.data?.embed_url ?? "")
      setEmbedPath(json.data?.embed_path ?? "")
      setJsonFeedUrl(json.data?.json_feed_url ?? "")
      setHeadline(embed.headline)
      setSubheadline(embed.subheadline)
      setCtaPrimary(embed.cta_primary)
      setCtaSecondary(embed.cta_secondary)
      setPartnerLabel(embed.partner_label ?? "")
      setIsActive(embed.is_active)
    } finally {
      setLoadingDetail(false)
    }
  }, [])

  const runSearch = React.useCallback(
    async (embedId: string, q: string) => {
      setSearching(true)
      try {
        const params = new URLSearchParams()
        if (q.trim()) params.set("q", q.trim())
        params.set("limit", String(INVENTORY_PAGE_SIZE))
        const res = await fetch(
          `/api/admin/partner-embeds/${encodeURIComponent(embedId)}/search?${params.toString()}`,
          { credentials: "include" },
        )
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
    },
    [],
  )

  React.useEffect(() => {
    void loadEmbeds()
  }, [loadEmbeds])

  React.useEffect(() => {
    if (!selectedId) return
    void loadDetail(selectedId)
    void runSearch(selectedId, "")
    setSearchQuery("")
  }, [selectedId, loadDetail, runSearch])

  React.useEffect(() => {
    if (!selectedId) return
    const handle = window.setTimeout(() => {
      void runSearch(selectedId, searchQuery)
    }, SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(handle)
  }, [selectedId, searchQuery, runSearch])

  async function onCreateEmbed() {
    const name = newName.trim()
    if (name.length < 2) {
      toast.error("Enter a partner name (at least 2 characters)")
      return
    }
    setCreating(true)
    try {
      const res = await fetch("/api/admin/partner-embeds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name }),
      })
      const json = (await res.json().catch(() => ({}))) as {
        data?: { id: string; slug: string }
        error?: string
      }
      if (!res.ok) {
        toast.error(typeof json.error === "string" ? json.error : "Could not create embed")
        return
      }
      toast.success("Partner embed created")
      setNewName("")
      await loadEmbeds()
      if (json.data?.id) setSelectedId(json.data.id)
    } finally {
      setCreating(false)
    }
  }

  async function onSaveMeta() {
    if (!selectedId) return
    setSavingMeta(true)
    try {
      const res = await fetch(`/api/admin/partner-embeds/${encodeURIComponent(selectedId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          headline,
          subheadline,
          cta_primary: ctaPrimary,
          cta_secondary: ctaSecondary,
          partner_label: partnerLabel.trim() || null,
          is_active: isActive,
        }),
      })
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        toast.error(typeof json.error === "string" ? json.error : "Could not save")
        return
      }
      toast.success("Embed settings saved")
      await loadEmbeds()
      await loadDetail(selectedId)
    } finally {
      setSavingMeta(false)
    }
  }

  async function persistReorder(next: CurationRow[]) {
    if (!selectedId) return
    setReordering(true)
    try {
      const res = await fetch(
        `/api/admin/partner-embeds/${encodeURIComponent(selectedId)}/listings`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ ordered_row_ids: next.map((r) => r.id) }),
        },
      )
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        toast.error(typeof json.error === "string" ? json.error : "Could not reorder")
        await loadDetail(selectedId)
        return
      }
      setRows(next)
      toast.success("Order updated")
    } finally {
      setReordering(false)
    }
  }

  async function onAddListing(listingId: string) {
    if (!selectedId) return
    setAddingListingId(listingId)
    try {
      const res = await fetch(
        `/api/admin/partner-embeds/${encodeURIComponent(selectedId)}/listings`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ listing_id: listingId }),
        },
      )
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        toast.error(typeof json.error === "string" ? json.error : "Could not add listing")
        return
      }
      toast.success("Listing added to feed")
      await loadDetail(selectedId)
      await runSearch(selectedId, searchQuery)
    } finally {
      setAddingListingId(null)
    }
  }

  async function onRemoveRow(rowId: string) {
    if (!selectedId) return
    setDeletingRowId(rowId)
    try {
      const res = await fetch(
        `/api/admin/partner-embeds/${encodeURIComponent(selectedId)}/listings/${encodeURIComponent(rowId)}`,
        { method: "DELETE", credentials: "include" },
      )
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        toast.error(typeof json.error === "string" ? json.error : "Could not remove listing")
        return
      }
      toast.success("Removed from feed")
      setRows((prev) => prev.filter((r) => r.id !== rowId))
      await runSearch(selectedId, searchQuery)
    } finally {
      setDeletingRowId(null)
    }
  }

  async function copySnippet() {
    if (!embedSnippet) return
    try {
      await navigator.clipboard.writeText(embedSnippet)
      toast.success("Embed code copied")
    } catch {
      toast.error("Could not copy — select and copy manually")
    }
  }

  const curatedIds = React.useMemo(() => new Set(rows.map((r) => r.listing_id)), [rows])

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Partner embeds</h2>
        <p className="text-sm text-muted-foreground">
          Curate surfboard listings and give partner sites a copy-paste iframe banner (like a display ad).
          Updates here appear on their site automatically — no redeploy needed on their end.
        </p>
        <div className="flex flex-wrap gap-2">
          {loadingEmbeds ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : embeds.length === 0 ? (
            <p className="text-sm text-muted-foreground">No embeds yet — create one below.</p>
          ) : (
            embeds.map((embed) => (
              <Button
                key={embed.id}
                type="button"
                variant={selectedId === embed.id ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedId(embed.id)}
              >
                {embed.name}
                {!embed.is_active ? (
                  <Badge variant="secondary" className="ml-2">
                    Off
                  </Badge>
                ) : null}
              </Button>
            ))
          )}
        </div>
        <div className="flex max-w-md gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New partner name (e.g. 17ft.com)"
            aria-label="New partner name"
          />
          <Button type="button" onClick={() => void onCreateEmbed()} disabled={creating}>
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </Button>
        </div>
      </section>

      {!selectedId || loadingDetail ? (
        selectedId ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : null
      ) : detail ? (
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div className="space-y-6">
            <section className="space-y-3 rounded-lg border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">Banner copy</h3>
                <div className="flex items-center gap-2">
                  <Label htmlFor="embed-active" className="text-xs text-muted-foreground">
                    Live
                  </Label>
                  <Switch id="embed-active" checked={isActive} onCheckedChange={setIsActive} />
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="partner-label">Partner label (optional)</Label>
                  <Input
                    id="partner-label"
                    value={partnerLabel}
                    onChange={(e) => setPartnerLabel(e.target.value)}
                    placeholder="17ft.com"
                  />
                </div>
                <div>
                  <Label htmlFor="headline">Headline</Label>
                  <Input id="headline" value={headline} onChange={(e) => setHeadline(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="subheadline">Subheadline</Label>
                  <Input
                    id="subheadline"
                    value={subheadline}
                    onChange={(e) => setSubheadline(e.target.value)}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="cta-primary">CTA primary</Label>
                    <Input
                      id="cta-primary"
                      value={ctaPrimary}
                      onChange={(e) => setCtaPrimary(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="cta-secondary">CTA secondary</Label>
                    <Input
                      id="cta-secondary"
                      value={ctaSecondary}
                      onChange={(e) => setCtaSecondary(e.target.value)}
                    />
                  </div>
                </div>
                <Button type="button" onClick={() => void onSaveMeta()} disabled={savingMeta}>
                  {savingMeta ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    "Save banner copy"
                  )}
                </Button>
              </div>
            </section>

            <section className="space-y-3 rounded-lg border border-border p-4">
              <h3 className="text-sm font-semibold">Live preview</h3>
              <p className="text-xs text-muted-foreground">
                Preview uses this environment (localhost in dev). The copy-paste embed code below uses
                your production URL for partner sites — deploy first before sharing it.
              </p>
              {embedPath ? (
                <div className="overflow-hidden rounded-md border border-border bg-muted/20">
                  <iframe
                    src={embedPath}
                    title={`Preview: ${detail.name}`}
                    className="block w-full border-0"
                    height={168}
                    loading="lazy"
                  />
                </div>
              ) : null}
            </section>

            <section className="space-y-3 rounded-lg border border-border p-4">
              <h3 className="text-sm font-semibold">Embed code for partner ({detail.slug})</h3>
              <p className="text-xs text-muted-foreground">
                Send this HTML block to the partner after deploy. They paste it anywhere on their site
                (WordPress HTML block, sidebar widget, etc.). Height auto-adjusts via postMessage.
              </p>
              <Textarea readOnly value={embedSnippet} rows={12} className="font-mono text-xs" />
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => void copySnippet()}>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy embed code
                </Button>
                {embedPath ? (
                  <Button type="button" variant="outline" size="sm" asChild>
                    <Link href={embedPath} target="_blank" rel="noreferrer">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Open preview
                    </Link>
                  </Button>
                ) : null}
              </div>
              {embedUrl ? (
                <p className="text-xs text-muted-foreground">
                  Production embed URL (after deploy):{" "}
                  <a href={embedUrl} target="_blank" rel="noreferrer" className="underline">
                    {embedUrl}
                  </a>
                </p>
              ) : null}
              {jsonFeedUrl ? (
                <p className="text-xs text-muted-foreground">
                  JSON feed (optional, if they want to build their own UI):{" "}
                  <a href={jsonFeedUrl} target="_blank" rel="noreferrer" className="underline">
                    {jsonFeedUrl}
                  </a>
                </p>
              ) : null}
            </section>
          </div>

          <div className="space-y-6">
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Feed listings ({rows.length})</h3>
              <p className="text-xs text-muted-foreground">
                Up to 4 show in the banner. Order matters — drag via arrows. Only active, site-visible
                surfboards appear on the live embed.
              </p>
              {rows.length === 0 ? (
                <p className="rounded-md border border-dashed px-3 py-4 text-xs text-muted-foreground">
                  No listings selected. Search below to add boards.
                </p>
              ) : (
                <ul className="space-y-2">
                  {rows.map((row, i) => (
                    <li
                      key={row.id}
                      className="flex items-center gap-2 rounded-lg border border-border/80 bg-muted/20 p-2"
                    >
                      <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-md bg-muted">
                        {row.listing.primary_image_url ? (
                          <Image
                            src={row.listing.primary_image_url}
                            alt=""
                            fill
                            sizes="80px"
                            className="object-cover"
                            unoptimized={row.listing.primary_image_url.startsWith("/")}
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <Link
                          href={listingDetailHref({ slug: row.listing.slug, id: row.listing.id })}
                          target="_blank"
                          rel="noreferrer"
                          className="line-clamp-2 text-sm font-medium hover:underline"
                        >
                          {row.listing.title}
                        </Link>
                        {row.listing.status !== "active" || row.listing.hidden_from_site ? (
                          <p className="text-[11px] text-amber-700">Won&apos;t show on live embed</p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 items-center gap-0.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9"
                          disabled={reordering || i <= 0}
                          onClick={() => {
                            const next = rows.slice()
                            const [item] = next.splice(i, 1)
                            if (!item) return
                            next.unshift(item)
                            void persistReorder(next)
                          }}
                        >
                          <ChevronsUp className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9"
                          disabled={reordering || i <= 0}
                          onClick={() => {
                            const next = rows.slice()
                            ;[next[i - 1], next[i]] = [next[i]!, next[i - 1]!]
                            void persistReorder(next)
                          }}
                        >
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9"
                          disabled={reordering || i >= rows.length - 1}
                          onClick={() => {
                            const next = rows.slice()
                            ;[next[i], next[i + 1]] = [next[i + 1]!, next[i]!]
                            void persistReorder(next)
                          }}
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9"
                          disabled={deletingRowId === row.id}
                          onClick={() => void onRemoveRow(row.id)}
                        >
                          {deletingRowId === row.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Add listings</h3>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search active surfboards…"
                  className="pl-9"
                />
              </div>
              {searching && searchHits.length === 0 ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <ul className="max-h-[360px] space-y-2 overflow-y-auto">
                  {searchHits.map((hit) => {
                    const isCurated = curatedIds.has(hit.id) || hit.already_curated
                    return (
                      <li
                        key={hit.id}
                        className={cn(
                          "flex items-center gap-2 rounded-lg border p-2",
                          isCurated ? "border-border/60 bg-muted/10" : "border-border/80 bg-muted/20",
                        )}
                      >
                        <div className="relative h-12 w-16 shrink-0 overflow-hidden rounded bg-muted">
                          {hit.primary_image_url ? (
                            <Image
                              src={hit.primary_image_url}
                              alt=""
                              fill
                              sizes="64px"
                              className="object-cover"
                              unoptimized={hit.primary_image_url.startsWith("/")}
                            />
                          ) : null}
                        </div>
                        <p className="min-w-0 flex-1 line-clamp-2 text-sm">{hit.title}</p>
                        <Button
                          type="button"
                          size="sm"
                          variant={isCurated ? "secondary" : "outline"}
                          disabled={isCurated || addingListingId === hit.id}
                          onClick={() => void onAddListing(hit.id)}
                        >
                          {addingListingId === hit.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : isCurated ? (
                            "Added"
                          ) : (
                            "Add"
                          )}
                        </Button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          </div>
        </div>
      ) : null}
    </div>
  )
}
