"use client"

import { useState } from "react"
import { toast } from "sonner"
import type { PeerListingSection } from "@/lib/peer-listing-sections"
import type {
  PublicShopifyConnection,
  ShopifyCatalogProduct,
  ShopifyDashboardData,
} from "@/lib/shopify/types"

type ProductPage = {
  products: ShopifyCatalogProduct[]
  pageInfo: { hasNextPage: boolean; endCursor: string | null }
}

type ReconcileResult = {
  removedListingIds: string[]
  sweepFailed: boolean
}

function reconcileMessage(result: ReconcileResult): string {
  if (result.sweepFailed) {
    return "Sync queued. Shopify could not be checked for deleted products yet."
  }
  const removed = result.removedListingIds.length
  if (removed === 0) return "Sync queued. No deleted Shopify products found."
  return `Removed ${removed} listing${removed === 1 ? "" : "s"} deleted in Shopify. Full sync queued.`
}

export function useShopifyIntegration(initialData: ShopifyDashboardData) {
  const [connection, setConnection] = useState<PublicShopifyConnection | null>(
    initialData.connection,
  )
  const [products, setProducts] = useState(initialData.products)
  const [pageInfo, setPageInfo] = useState(initialData.productPageInfo)
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [busyProductId, setBusyProductId] = useState<string | null>(null)
  const [connectionBusy, setConnectionBusy] = useState(false)

  async function loadProducts(append: boolean) {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (query.trim()) params.set("query", query.trim())
      if (append && pageInfo.endCursor) params.set("after", pageInfo.endCursor)
      const response = await fetch(
        `/api/integrations/shopify/products?${params.toString()}`,
      )
      const body = (await response.json()) as {
        data?: ProductPage
        error?: string
      }
      if (!response.ok || !body.data) {
        toast.error(body.error || "Could not load Shopify products")
        return
      }
      setProducts((current) =>
        append ? [...current, ...body.data!.products] : body.data!.products,
      )
      setPageInfo(body.data.pageInfo)
    } catch {
      toast.error("Could not load Shopify products")
    } finally {
      setLoading(false)
    }
  }

  async function publishProduct(
    productId: string,
    section: PeerListingSection,
  ): Promise<boolean> {
    setBusyProductId(productId)
    try {
      const response = await fetch("/api/integrations/shopify/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, section }),
      })
      const body = (await response.json()) as { error?: string }
      if (!response.ok) {
        toast.error(body.error || "Could not publish this product")
        return false
      }
      setProducts((current) =>
        current.map((product) =>
          product.id === productId
            ? { ...product, selected: true, selectedSection: section }
            : product,
        ),
      )
      toast.success("Shopify product published on Reswell")
      return true
    } catch {
      toast.error("Could not publish this product")
      return false
    } finally {
      setBusyProductId(null)
    }
  }

  async function unpublishProduct(productId: string): Promise<boolean> {
    setBusyProductId(productId)
    try {
      const response = await fetch("/api/integrations/shopify/products", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
      })
      const body = (await response.json()) as { error?: string }
      if (!response.ok) {
        toast.error(body.error || "Could not unpublish this product")
        return false
      }
      setProducts((current) =>
        current.map((product) =>
          product.id === productId
            ? { ...product, selected: false, selectedSection: null }
            : product,
        ),
      )
      toast.success("Product unpublished from Reswell")
      return true
    } catch {
      toast.error("Could not unpublish this product")
      return false
    } finally {
      setBusyProductId(null)
    }
  }

  async function requestSync(): Promise<boolean> {
    setConnectionBusy(true)
    try {
      const response = await fetch("/api/integrations/shopify/reconcile", {
        method: "POST",
      })
      const body = (await response.json()) as {
        data?: ReconcileResult
        error?: string
      }
      if (!response.ok || !body.data) {
        toast.error(body.error || "Could not queue Shopify sync")
        return false
      }
      toast.success(reconcileMessage(body.data))
      return true
    } catch {
      toast.error("Could not queue Shopify sync")
      return false
    } finally {
      setConnectionBusy(false)
    }
  }

  async function disconnect() {
    if (!window.confirm("Disconnect Shopify and unpublish its Reswell listings?")) {
      return
    }
    setConnectionBusy(true)
    try {
      const response = await fetch("/api/integrations/shopify/disconnect", {
        method: "POST",
      })
      const body = (await response.json()) as { error?: string }
      if (!response.ok) {
        toast.error(body.error || "Could not disconnect Shopify")
        return
      }
      setConnection(null)
      setProducts([])
      toast.success("Shopify disconnected")
    } catch {
      toast.error("Could not disconnect Shopify")
    } finally {
      setConnectionBusy(false)
    }
  }

  return {
    connection,
    products,
    pageInfo,
    query,
    setQuery,
    loading,
    busyProductId,
    connectionBusy,
    loadProducts,
    publishProduct,
    unpublishProduct,
    requestSync,
    disconnect,
  }
}
