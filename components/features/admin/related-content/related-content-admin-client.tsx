"use client"

import * as React from "react"
import Link from "next/link"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { RelatedContentAddSearch } from "@/components/features/admin/related-content/related-content-add-search"
import { RelatedContentHostPane } from "@/components/features/admin/related-content/related-content-host-pane"
import { RelatedContentItemRows } from "@/components/features/admin/related-content/related-content-item-rows"
import type {
  BlogSearchHit,
  ListingSearchHit,
  RelatedContentAdminItem,
  RelatedContentHostSummary,
  RelatedContentListingSummary,
} from "@/components/features/admin/related-content/related-content-admin-types"
import { listingDetailHref } from "@/lib/listing-href"

const SEARCH_DEBOUNCE_MS = 220

export function RelatedContentAdminClient() {
  const [hosts, setHosts] = React.useState<RelatedContentHostSummary[]>([])
  const [loadingHosts, setLoadingHosts] = React.useState(true)
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [listing, setListing] = React.useState<RelatedContentListingSummary | null>(null)
  const [items, setItems] = React.useState<RelatedContentAdminItem[]>([])
  const [loadingDetail, setLoadingDetail] = React.useState(false)
  const [hostQuery, setHostQuery] = React.useState("")
  const [hostHits, setHostHits] = React.useState<ListingSearchHit[]>([])
  const [searchingHosts, setSearchingHosts] = React.useState(false)
  const [addTab, setAddTab] = React.useState<"blog" | "listing">("blog")
  const [addQuery, setAddQuery] = React.useState("")
  const [listingHits, setListingHits] = React.useState<ListingSearchHit[]>([])
  const [blogHits, setBlogHits] = React.useState<BlogSearchHit[]>([])
  const [searchingAdd, setSearchingAdd] = React.useState(false)
  const [addingId, setAddingId] = React.useState<string | null>(null)
  const [deletingRowId, setDeletingRowId] = React.useState<string | null>(null)
  const [reordering, setReordering] = React.useState(false)

  const loadHosts = React.useCallback(async () => {
    setLoadingHosts(true)
    try {
      const res = await fetch("/api/admin/related-content", { credentials: "include" })
      const json = (await res.json().catch(() => ({}))) as {
        data?: { hosts: RelatedContentHostSummary[] }
        error?: string
      }
      if (!res.ok) {
        toast.error(typeof json.error === "string" ? json.error : "Could not load related content")
        return
      }
      setHosts(Array.isArray(json.data?.hosts) ? json.data.hosts : [])
    } finally {
      setLoadingHosts(false)
    }
  }, [])

  const loadDetail = React.useCallback(async (listingId: string) => {
    setLoadingDetail(true)
    try {
      const res = await fetch(`/api/admin/related-content/${encodeURIComponent(listingId)}`, {
        credentials: "include",
      })
      const json = (await res.json().catch(() => ({}))) as {
        data?: { listing: RelatedContentListingSummary; items: RelatedContentAdminItem[] }
        error?: string
      }
      if (!res.ok) {
        toast.error(typeof json.error === "string" ? json.error : "Could not load listing")
        return
      }
      setListing(json.data?.listing ?? null)
      setItems(Array.isArray(json.data?.items) ? json.data.items : [])
    } finally {
      setLoadingDetail(false)
    }
  }, [])

  const runSearch = React.useCallback(
    async (type: "host" | "blog" | "listing", q: string, hostListingId?: string | null) => {
      const params = new URLSearchParams({ type, q })
      if (hostListingId) params.set("host_listing_id", hostListingId)
      if (type === "host") params.set("limit", "40")
      const res = await fetch(`/api/admin/related-content/search?${params.toString()}`, {
        credentials: "include",
      })
      const json = (await res.json().catch(() => ({}))) as {
        data?: { listings?: ListingSearchHit[]; blogs?: BlogSearchHit[] }
        error?: string
      }
      if (!res.ok) {
        toast.error(typeof json.error === "string" ? json.error : "Search failed")
        return { listings: [] as ListingSearchHit[], blogs: [] as BlogSearchHit[] }
      }
      return {
        listings: Array.isArray(json.data?.listings) ? json.data.listings : [],
        blogs: Array.isArray(json.data?.blogs) ? json.data.blogs : [],
      }
    },
    [],
  )

  React.useEffect(() => {
    void loadHosts()
  }, [loadHosts])

  React.useEffect(() => {
    if (!selectedId) {
      setListing(null)
      setItems([])
      return
    }
    void loadDetail(selectedId)
    setAddQuery("")
  }, [selectedId, loadDetail])

  React.useEffect(() => {
    const handle = window.setTimeout(() => {
      setSearchingHosts(true)
      void runSearch("host", hostQuery).then((result) => {
        setHostHits(result.listings)
        setSearchingHosts(false)
      })
    }, hostQuery.trim() ? SEARCH_DEBOUNCE_MS : 0)
    return () => window.clearTimeout(handle)
  }, [hostQuery, runSearch])

  React.useEffect(() => {
    if (!selectedId) return
    const handle = window.setTimeout(() => {
      setSearchingAdd(true)
      void runSearch(addTab, addQuery, selectedId).then((result) => {
        setListingHits(result.listings)
        setBlogHits(result.blogs)
        setSearchingAdd(false)
      })
    }, SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(handle)
  }, [selectedId, addTab, addQuery, runSearch])

  async function refreshSelected() {
    if (!selectedId) return
    await Promise.all([loadDetail(selectedId), loadHosts()])
  }

  async function onAdd(kind: "blog" | "listing", id: string) {
    if (!selectedId) return
    setAddingId(id)
    try {
      const res = await fetch(`/api/admin/related-content/${encodeURIComponent(selectedId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(
          kind === "blog" ? { kind, blog_post_id: id } : { kind, related_listing_id: id },
        ),
      })
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        toast.error(typeof json.error === "string" ? json.error : "Could not add item")
        return
      }
      toast.success(kind === "blog" ? "Blog attached" : "Listing attached")
      await refreshSelected()
    } finally {
      setAddingId(null)
    }
  }

  async function onRemove(rowId: string) {
    if (!selectedId) return
    setDeletingRowId(rowId)
    try {
      const res = await fetch(
        `/api/admin/related-content/${encodeURIComponent(selectedId)}/${encodeURIComponent(rowId)}`,
        { method: "DELETE", credentials: "include" },
      )
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        toast.error(typeof json.error === "string" ? json.error : "Could not remove item")
        return
      }
      toast.success("Removed")
      setItems((prev) => prev.filter((item) => item.id !== rowId))
      await loadHosts()
    } finally {
      setDeletingRowId(null)
    }
  }

  async function onMove(rowId: string, direction: -1 | 1) {
    if (!selectedId) return
    const index = items.findIndex((item) => item.id === rowId)
    const nextIndex = index + direction
    if (index < 0 || nextIndex < 0 || nextIndex >= items.length) return
    const next = [...items]
    const [moved] = next.splice(index, 1)
    if (!moved) return
    next.splice(nextIndex, 0, moved)
    setReordering(true)
    try {
      const res = await fetch(`/api/admin/related-content/${encodeURIComponent(selectedId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ordered_row_ids: next.map((item) => item.id) }),
      })
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        toast.error(typeof json.error === "string" ? json.error : "Could not reorder")
        await loadDetail(selectedId)
        return
      }
      setItems(next)
    } finally {
      setReordering(false)
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(18rem,22rem)_minmax(0,1fr)]">
      <RelatedContentHostPane
        hosts={hosts}
        loadingHosts={loadingHosts}
        selectedId={selectedId}
        onSelect={setSelectedId}
        hostQuery={hostQuery}
        onHostQueryChange={setHostQuery}
        hostHits={hostHits}
        searchingHosts={searchingHosts}
      />

      <div className="space-y-6">
        {!selectedId ? (
          <p className="rounded-lg border border-dashed border-border p-8 text-sm text-muted-foreground">
            Choose a listing to attach related blogs and listings.
          </p>
        ) : loadingDetail || !listing ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <section className="space-y-3 rounded-lg border border-border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-foreground">{listing.title}</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {listing.section ?? "listing"}
                    {listing.status ? ` · ${listing.status}` : ""}
                    {listing.hidden_from_site ? " · hidden" : ""}
                  </p>
                </div>
                <Link
                  href={listingDetailHref({ id: listing.id, slug: listing.slug })}
                  className="text-sm text-muted-foreground underline-offset-4 hover:underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  Open listing page
                </Link>
              </div>
              <RelatedContentItemRows
                items={items}
                reordering={reordering}
                deletingRowId={deletingRowId}
                onMove={(rowId, direction) => void onMove(rowId, direction)}
                onRemove={(rowId) => void onRemove(rowId)}
              />
            </section>
            <RelatedContentAddSearch
              addTab={addTab}
              onAddTabChange={setAddTab}
              query={addQuery}
              onQueryChange={setAddQuery}
              searching={searchingAdd}
              listingHits={listingHits}
              blogHits={blogHits}
              addingId={addingId}
              onAddListing={(id) => void onAdd("listing", id)}
              onAddBlog={(id) => void onAdd("blog", id)}
            />
          </>
        )}
      </div>
    </div>
  )
}
