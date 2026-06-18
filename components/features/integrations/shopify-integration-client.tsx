"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  Plug,
  RefreshCw,
  ShoppingBag,
  Unplug,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PEER_LISTING_SECTIONS } from "@/lib/peer-listing-sections"
import { cn } from "@/lib/utils"
import type { ShopifyProductPreview } from "@/app/api/integrations/shopify/products/route"
import { ShopifySettingsCard } from "@/components/features/integrations/shopify/shopify-settings-card"
import { ShopifyActivityCard } from "@/components/features/integrations/shopify/shopify-activity-card"

type ShopifyConnectionPublic = {
  id: string
  shop_domain: string
  shop_name: string | null
  status: string
  connected_at: string
  last_sync_at: string | null
  last_error: string | null
  sync_mode: string
  sync_tags: string[]
  auto_sync_enabled: boolean
  pricing_mode: string
  markup_percent: number
  last_full_sync_at: string | null
}

type StatusResponse = {
  data?: {
    configured: boolean
    access: boolean
    profile: {
      shopify_connect_enabled: boolean
      is_shop: boolean
      shop_verified: boolean
    }
    connection: ShopifyConnectionPublic | null
    linkedCount: number
    mappings: Array<{
      signal_type: string
      signal_value: string
      reswell_section: string
    }>
  }
  error?: string
}

function sectionLabel(section: string): string {
  return section.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

export function ShopifyIntegrationClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<StatusResponse["data"] | null>(null)
  const [shopDomain, setShopDomain] = useState("")
  const [products, setProducts] = useState<ShopifyProductPreview[]>([])
  const [productsLoading, setProductsLoading] = useState(false)
  const [nextPageInfo, setNextPageInfo] = useState<string | null>(null)
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set())
  const [importing, setImporting] = useState(false)
  const [sectionOverride, setSectionOverride] = useState<string>("auto")
  const [disconnecting, setDisconnecting] = useState(false)
  const [fullSyncing, setFullSyncing] = useState(false)

  const loadStatus = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/integrations/shopify/status")
      const json = (await res.json()) as StatusResponse
      if (!res.ok) {
        toast.error(json.error ?? "Could not load Shopify status")
        return
      }
      setStatus(json.data ?? null)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadProducts = useCallback(async (pageInfo?: string | null) => {
    if (!status?.connection) return
    setProductsLoading(true)
    try {
      const params = new URLSearchParams()
      if (pageInfo) params.set("page_info", pageInfo)
      const res = await fetch(`/api/integrations/shopify/products?${params.toString()}`)
      const json = (await res.json()) as {
        data?: { products: ShopifyProductPreview[]; nextPageInfo: string | null }
        error?: string
      }
      if (!res.ok) {
        toast.error(json.error ?? "Could not load Shopify products")
        return
      }
      setProducts((prev) => (pageInfo ? [...prev, ...(json.data?.products ?? [])] : json.data?.products ?? []))
      setNextPageInfo(json.data?.nextPageInfo ?? null)
    } finally {
      setProductsLoading(false)
    }
  }, [status?.connection])

  useEffect(() => {
    void loadStatus()
  }, [loadStatus])

  useEffect(() => {
    const connected = searchParams.get("connected")
    const error = searchParams.get("error")
    if (connected === "1") {
      toast.success("Shopify store connected")
      router.replace("/dashboard/integrations/shopify")
    } else if (error) {
      toast.error("Shopify connection failed. Try again or contact support.")
      router.replace("/dashboard/integrations/shopify")
    }
  }, [router, searchParams])

  useEffect(() => {
    if (status?.connection) {
      void loadProducts()
    }
  }, [status?.connection, loadProducts])

  const importableSelected = useMemo(
    () => products.filter((p) => selectedProductIds.has(p.id)),
    [products, selectedProductIds],
  )

  async function handleConnect() {
    const shop = shopDomain.trim()
    if (!shop) {
      toast.error("Enter your Shopify store domain")
      return
    }
    window.location.href = `/api/integrations/shopify/connect?shop=${encodeURIComponent(shop)}`
  }

  async function handleDisconnect() {
    setDisconnecting(true)
    try {
      const res = await fetch("/api/integrations/shopify/disconnect", { method: "POST" })
      if (!res.ok) {
        const json = (await res.json()) as { error?: string }
        toast.error(json.error ?? "Could not disconnect")
        return
      }
      toast.success("Shopify disconnected")
      setProducts([])
      setSelectedProductIds(new Set())
      await loadStatus()
    } finally {
      setDisconnecting(false)
    }
  }

  async function handleImportSelected() {
    if (importableSelected.length === 0) {
      toast.error("Select at least one product")
      return
    }
    setImporting(true)
    try {
      const body: Record<string, unknown> = {
        productIds: importableSelected.map((p) => p.id),
      }
      if (sectionOverride !== "auto") {
        body.section = sectionOverride
      }
      const res = await fetch("/api/integrations/shopify/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const json = (await res.json()) as {
        data?: { imported: number; failed: number }
        error?: string
      }
      if (!res.ok) {
        toast.error(json.error ?? "Import failed")
        return
      }
      toast.success(`Imported ${json.data?.imported ?? 0} listing(s)`)
      if ((json.data?.failed ?? 0) > 0) {
        toast.message(`${json.data?.failed} variant(s) could not be mapped — check product type or tags`)
      }
      setSelectedProductIds(new Set())
      await loadStatus()
      await loadProducts()
    } finally {
      setImporting(false)
    }
  }

  async function handleFullSync() {
    setFullSyncing(true)
    try {
      const res = await fetch("/api/integrations/shopify/sync", { method: "POST" })
      const json = (await res.json()) as { message?: string; error?: string }
      if (!res.ok) {
        toast.error(json.error ?? "Could not start sync")
        return
      }
      toast.success(json.message ?? "Full sync started")
    } finally {
      setFullSyncing(false)
    }
  }

  function toggleProduct(id: string, checked: boolean) {
    setSelectedProductIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading Shopify integration…
      </div>
    )
  }

  if (!status?.access) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Shopify integration</CardTitle>
          <CardDescription>
            Import products from your Shopify store as Reswell listings — fins, wetsuits, boards, and more.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Connect your verified Reswell shop to import and sync products from Shopify. Need help? Contact
            support.
          </p>
        </CardContent>
      </Card>
    )
  }

  if (!status.configured) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Shopify integration</CardTitle>
          <CardDescription>Shopify API credentials are not configured on this environment.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Shopify</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect your store to import products as Reswell listings. They appear on the same browse pages and seller
          profile as manually listed gear — checkout stays on Reswell.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Plug className="h-5 w-5" />
            Store connection
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {status.connection ? (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">{status.connection.shop_name ?? status.connection.shop_domain}</p>
                <p className="text-sm text-muted-foreground">{status.connection.shop_domain}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {status.linkedCount} linked listing{status.linkedCount !== 1 ? "s" : ""}
                  {status.connection.last_sync_at
                    ? ` · Last sync ${new Date(status.connection.last_sync_at).toLocaleString()}`
                    : null}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" asChild>
                  <a
                    href={`https://${status.connection.shop_domain}/admin`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Open Shopify
                  </a>
                </Button>
                <Button variant="outline" onClick={() => void loadProducts()} disabled={productsLoading}>
                  <RefreshCw className={cn("mr-2 h-4 w-4", productsLoading && "animate-spin")} />
                  Refresh products
                </Button>
                <Button variant="outline" onClick={() => void handleFullSync()} disabled={fullSyncing}>
                  <RefreshCw className={cn("mr-2 h-4 w-4", fullSyncing && "animate-spin")} />
                  Run full sync
                </Button>
                <Button variant="destructive" onClick={() => void handleDisconnect()} disabled={disconnecting}>
                  {disconnecting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Unplug className="mr-2 h-4 w-4" />
                  )}
                  Disconnect
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3 max-w-md">
              <div className="space-y-2">
                <Label htmlFor="shop-domain">Shopify store domain</Label>
                <Input
                  id="shop-domain"
                  placeholder="your-brand.myshopify.com"
                  value={shopDomain}
                  onChange={(e) => setShopDomain(e.target.value)}
                />
              </div>
              <Button onClick={() => void handleConnect()}>
                <ShoppingBag className="mr-2 h-4 w-4" />
                Connect Shopify
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {status.connection ? (
        <>
          <ShopifySettingsCard
            value={{
              sync_mode: status.connection.sync_mode,
              sync_tags: status.connection.sync_tags ?? [],
              auto_sync_enabled: status.connection.auto_sync_enabled,
              pricing_mode: status.connection.pricing_mode,
              markup_percent: status.connection.markup_percent,
            }}
            onSaved={() => void loadStatus()}
          />

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Import products</CardTitle>
              <CardDescription>
                Tag products in Shopify with{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-xs">reswell:section:fins</code> or match product
                type (Fin, Wetsuit, Surfboard…). Unmapped products can be forced with the section override below.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="space-y-2 sm:w-56">
                  <Label>Section override (optional)</Label>
                  <Select value={sectionOverride} onValueChange={setSectionOverride}>
                    <SelectTrigger>
                      <SelectValue placeholder="Auto-detect" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto-detect</SelectItem>
                      {PEER_LISTING_SECTIONS.map((section) => (
                        <SelectItem key={section} value={section}>
                          {sectionLabel(section)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={() => void handleImportSelected()}
                  disabled={importing || importableSelected.length === 0}
                >
                  {importing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                  )}
                  Import selected ({importableSelected.length})
                </Button>
              </div>

              {productsLoading && products.length === 0 ? (
                <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading products from Shopify…
                </div>
              ) : products.length === 0 ? (
                <p className="py-6 text-sm text-muted-foreground">No products found in your Shopify store.</p>
              ) : (
                <ul className="divide-y divide-border rounded-lg border">
                  {products.map((product) => {
                    const linked = product.linked
                    const checked = selectedProductIds.has(product.id)
                    return (
                      <li key={product.id} className="flex gap-3 p-3 sm:gap-4 sm:p-4">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => toggleProduct(product.id, v === true)}
                          aria-label={`Select ${product.title}`}
                          className="mt-1"
                        />
                        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md bg-muted">
                          {product.imageUrl ? (
                            <Image
                              src={product.imageUrl}
                              alt=""
                              fill
                              className="object-cover"
                              unoptimized
                            />
                          ) : null}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium text-sm sm:text-base">{product.title}</p>
                            {linked ? (
                              <Badge variant="secondary" className="text-xs">
                                Linked
                              </Badge>
                            ) : null}
                            {product.detectedSection ? (
                              <Badge variant="outline" className="text-xs">
                                → {sectionLabel(product.detectedSection)}
                              </Badge>
                            ) : (
                              <Badge variant="destructive" className="text-xs">
                                Unmapped
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground sm:text-sm">
                            {product.productType || "No product type"} · {product.variantCount} variant
                            {product.variantCount !== 1 ? "s" : ""}
                            {product.vendor ? ` · ${product.vendor}` : ""}
                          </p>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}

              {nextPageInfo ? (
                <Button variant="outline" onClick={() => void loadProducts(nextPageInfo)} disabled={productsLoading}>
                  {productsLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Load more
                </Button>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Tips for mixed catalogs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>
                Use Shopify tags like{" "}
                <code className="rounded bg-muted px-1">reswell:section:wetsuits</code>,{" "}
                <code className="rounded bg-muted px-1">reswell:section:fins</code>, or{" "}
                <code className="rounded bg-muted px-1">reswell:size:m</code> on fin listings.
              </p>
              <p>
                Set accurate Shopify product types (Fin, Wetsuit, Surfboard, Leash…) — default mappings are applied on
                connect.
              </p>
              <p>
                Imported listings show on your{" "}
                <Link href="/dashboard/listings" className="text-primary hover:underline">
                  My Listings
                </Link>{" "}
                page and public seller profile alongside manual listings.
              </p>
            </CardContent>
          </Card>

          <ShopifyActivityCard />
        </>
      ) : null}
    </div>
  )
}
