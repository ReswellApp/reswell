"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Download, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { FACEBOOK_MARKETPLACE_BULK_UPLOAD_MAX } from "@/lib/facebook-marketplace/categories"
import type {
  FacebookMarketplaceBulkListingPreview,
  FacebookMarketplaceBulkSellerHit,
} from "@/lib/services/facebookMarketplaceBulkExport"
import { FacebookMarketplaceListingSelectPanel } from "@/components/features/admin/facebook-marketplace-bulk/listing-select-panel"
import { FacebookMarketplaceSellerSearchPanel } from "@/components/features/admin/facebook-marketplace-bulk/seller-search-panel"

const SEARCH_DEBOUNCE_MS = 200

type SelectedSeller = {
  id: string
  seller_slug: string
  display_name: string | null
  shop_name: string | null
}

export function FacebookMarketplaceBulkClient() {
  const searchParams = useSearchParams()
  const initialSellerId = searchParams.get("sellerId")?.trim() || null

  const [searchQuery, setSearchQuery] = useState("")
  const [searchHits, setSearchHits] = useState<FacebookMarketplaceBulkSellerHit[]>([])
  const [searching, setSearching] = useState(false)
  const [seller, setSeller] = useState<SelectedSeller | null>(null)
  const [listings, setListings] = useState<FacebookMarketplaceBulkListingPreview[]>([])
  const [skipped, setSkipped] = useState(0)
  const [loadingListings, setLoadingListings] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [exporting, setExporting] = useState(false)

  const runSearch = useCallback(async (q: string) => {
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
      params.set("limit", "40")
      const res = await fetch(`/api/admin/facebook-marketplace-bulk/sellers?${params.toString()}`, {
        credentials: "include",
      })
      const json = (await res.json().catch(() => ({}))) as {
        data?: { hits: FacebookMarketplaceBulkSellerHit[] }
        error?: string
      }
      if (!res.ok) {
        toast.error(typeof json.error === "string" ? json.error : "Search failed")
        setSearchHits([])
        return
      }
      setSearchHits(Array.isArray(json.data?.hits) ? json.data.hits : [])
    } finally {
      setSearching(false)
    }
  }, [])

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void runSearch(searchQuery)
    }, SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(handle)
  }, [searchQuery, runSearch])

  const loadSellerListings = useCallback(async (sellerId: string) => {
    setLoadingListings(true)
    try {
      const res = await fetch(
        `/api/admin/facebook-marketplace-bulk/sellers/${encodeURIComponent(sellerId)}/listings`,
        { credentials: "include" },
      )
      const json = (await res.json().catch(() => ({}))) as {
        data?: {
          seller: SelectedSeller
          listings: FacebookMarketplaceBulkListingPreview[]
          skipped: number
        }
        error?: string
      }
      if (!res.ok || !json.data) {
        toast.error(typeof json.error === "string" ? json.error : "Could not load listings")
        return
      }
      setSeller(json.data.seller)
      setListings(json.data.listings)
      setSkipped(json.data.skipped)
      setSelectedIds(
        new Set(json.data.listings.slice(0, FACEBOOK_MARKETPLACE_BULK_UPLOAD_MAX).map((listing) => listing.id)),
      )
    } finally {
      setLoadingListings(false)
    }
  }, [])

  useEffect(() => {
    if (!initialSellerId) return
    void loadSellerListings(initialSellerId)
  }, [initialSellerId, loadSellerListings])

  const selectedCount = selectedIds.size
  const allVisibleSelected = useMemo(() => {
    if (listings.length === 0) return false
    return listings
      .slice(0, FACEBOOK_MARKETPLACE_BULK_UPLOAD_MAX)
      .every((listing) => selectedIds.has(listing.id))
  }, [listings, selectedIds])

  function toggleListing(id: string, next: boolean) {
    setSelectedIds((prev) => {
      const copy = new Set(prev)
      if (next) {
        if (copy.size >= FACEBOOK_MARKETPLACE_BULK_UPLOAD_MAX && !copy.has(id)) {
          toast.error(`Facebook allows ${FACEBOOK_MARKETPLACE_BULK_UPLOAD_MAX} listings per spreadsheet`)
          return prev
        }
        copy.add(id)
      } else {
        copy.delete(id)
      }
      return copy
    })
  }

  async function downloadWorkbook() {
    if (!seller || selectedCount === 0) return
    setExporting(true)
    try {
      const res = await fetch("/api/admin/facebook-marketplace-bulk/export", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seller_id: seller.id,
          listing_ids: Array.from(selectedIds),
        }),
      })
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string }
        toast.error(typeof json.error === "string" ? json.error : "Export failed")
        return
      }
      const blob = await res.blob()
      const disposition = res.headers.get("Content-Disposition") ?? ""
      const match = disposition.match(/filename="([^"]+)"/)
      const filename = match?.[1] ?? "Marketplace_Bulk_Upload.xlsx"
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = filename
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
      toast.success(`Downloaded ${selectedCount} listing${selectedCount === 1 ? "" : "s"}`)
    } catch {
      toast.error("Export failed")
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-headline text-3xl font-bold tracking-tight text-foreground">
            FB Marketplace export
          </h1>
          <Badge variant="secondary">Bulk upload</Badge>
        </div>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Choose a seller, pick active listings, and download Facebook’s Marketplace bulk-upload
          spreadsheet. Facebook accepts up to {FACEBOOK_MARKETPLACE_BULK_UPLOAD_MAX} listings per file.
          Photos are added in Marketplace after you upload the file.
        </p>
      </div>

      <FacebookMarketplaceSellerSearchPanel
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        searching={searching}
        searchHits={searchHits}
        selectedSellerId={seller?.id ?? null}
        onSelectSeller={(sellerId) => void loadSellerListings(sellerId)}
      />

      <FacebookMarketplaceListingSelectPanel
        seller={seller}
        listings={listings}
        skipped={skipped}
        loading={loadingListings}
        selectedIds={selectedIds}
        allVisibleSelected={allVisibleSelected}
        onToggleListing={toggleListing}
        onSelectAll={() =>
          setSelectedIds(new Set(listings.slice(0, FACEBOOK_MARKETPLACE_BULK_UPLOAD_MAX).map((listing) => listing.id)))
        }
        onClearSelection={() => setSelectedIds(new Set())}
        onClearSeller={() => {
          setSeller(null)
          setListings([])
          setSelectedIds(new Set())
          setSkipped(0)
        }}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Download fills TITLE, PRICE, CONDITION, DESCRIPTION, and CATEGORY in Facebook’s official template.
        </p>
        <Button
          type="button"
          onClick={() => void downloadWorkbook()}
          disabled={!seller || selectedCount === 0 || exporting}
        >
          {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          {exporting ? "Building spreadsheet…" : `Download spreadsheet (${selectedCount})`}
        </Button>
      </div>
    </div>
  )
}
