"use client"

import { useRef, useState } from "react"
import { toast } from "sonner"
import type { PeerListingSection } from "@/lib/peer-listing-sections"
import type {
  ShopifyCatalogManagerData,
  ShopifyLinkedListingFilter,
} from "@/lib/shopify/types"

interface LinkedListingQuery {
  filter: ShopifyLinkedListingFilter
  section: PeerListingSection | null
  query: string
  page: number
}

export function useShopifyLinkedListings(
  initialCatalog: ShopifyCatalogManagerData | null,
) {
  const [catalog, setCatalog] = useState(initialCatalog)
  const [params, setParams] = useState<LinkedListingQuery>({
    filter: "all",
    section: null,
    query: "",
    page: 1,
  })
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(false)
  const [busyProductId, setBusyProductId] = useState<string | null>(null)
  const requestId = useRef(0)

  async function load(next: Partial<LinkedListingQuery> = {}) {
    const merged = { ...params, ...next }
    setParams(merged)
    const current = ++requestId.current
    setLoading(true)
    try {
      const query = new URLSearchParams({
        filter: merged.filter,
        page: String(merged.page),
      })
      if (merged.section) query.set("section", merged.section)
      if (merged.query) query.set("query", merged.query)
      const response = await fetch(
        `/api/integrations/shopify/listings?${query.toString()}`,
      )
      const body = (await response.json()) as {
        data?: ShopifyCatalogManagerData | null
        error?: string
      }
      if (current !== requestId.current) return
      if (!response.ok || body.data === undefined) {
        toast.error(body.error || "Could not load Shopify listings")
        return
      }
      setCatalog(body.data)
    } catch {
      toast.error("Could not load Shopify listings")
    } finally {
      if (current === requestId.current) setLoading(false)
    }
  }

  async function resync(productId: string) {
    setBusyProductId(productId)
    try {
      const response = await fetch("/api/integrations/shopify/products/resync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
      })
      const body = (await response.json()) as {
        data?: { productMissing: boolean }
        error?: string
      }
      if (!response.ok || !body.data) {
        toast.error(body.error || "Could not sync this product")
        return
      }
      toast.success(
        body.data.productMissing
          ? "Deleted in Shopify, so it was removed from Reswell"
          : "Synced from Shopify",
      )
      await load()
    } catch {
      toast.error("Could not sync this product")
    } finally {
      setBusyProductId(null)
    }
  }

  return {
    catalog,
    params,
    search,
    setSearch,
    loading,
    busyProductId,
    setBusyProductId,
    load,
    resync,
  }
}

export type ShopifyLinkedListingsController = ReturnType<
  typeof useShopifyLinkedListings
>
