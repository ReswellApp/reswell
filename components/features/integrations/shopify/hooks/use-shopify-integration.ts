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
  ) {
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
        return
      }
      setProducts((current) =>
        current.map((product) =>
          product.id === productId
            ? { ...product, selected: true, selectedSection: section }
            : product,
        ),
      )
      toast.success("Shopify product published on Reswell")
    } catch {
      toast.error("Could not publish this product")
    } finally {
      setBusyProductId(null)
    }
  }

  async function unpublishProduct(productId: string) {
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
        return
      }
      setProducts((current) =>
        current.map((product) =>
          product.id === productId
            ? { ...product, selected: false, selectedSection: null }
            : product,
        ),
      )
      toast.success("Product unpublished from Reswell")
    } catch {
      toast.error("Could not unpublish this product")
    } finally {
      setBusyProductId(null)
    }
  }

  async function requestSync() {
    setConnectionBusy(true)
    try {
      const response = await fetch("/api/integrations/shopify/reconcile", {
        method: "POST",
      })
      const body = (await response.json()) as { error?: string }
      if (!response.ok) {
        toast.error(body.error || "Could not queue Shopify sync")
        return
      }
      toast.success("Shopify reconciliation queued")
    } catch {
      toast.error("Could not queue Shopify sync")
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
      if (!response.ok) throw new Error()
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
