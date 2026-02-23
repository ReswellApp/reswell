"use client"

import React from "react"
import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Search,
  ShoppingCart,
  ExternalLink,
  CheckCircle2,
  Loader2,
  MapPin,
  Store,
  Truck,
} from "lucide-react"

interface ShopifyImage {
  url: string
  altText: string | null
}

interface ShopifyBoardProduct {
  id: string
  handle: string
  title: string
  description: string
  availableForSale: boolean
  priceRange: {
    minVariantPrice: { amount: string; currencyCode: string }
  }
  compareAtPriceRange?: {
    minVariantPrice: { amount: string; currencyCode: string } | null
  } | null
  featuredImage: ShopifyImage | null
  images: { edges: Array<{ node: ShopifyImage }> }
  seller: {
    id: string
    name: string
    verified: boolean
    avatar_url: string | null
    shopify_domain: string
    sales_count: number
    shop_address: string | null
    city: string | null
    location: string | null
  }
}

export function ShopifyBoardsGrid() {
  const [products, setProducts] = useState<ShopifyBoardProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchInput, setSearchInput] = useState("")

  useEffect(() => {
    async function fetchProducts() {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        if (searchQuery) params.set("q", searchQuery)
        const res = await fetch(`/api/shopify/boards?${params.toString()}`)
        const data = await res.json()
        setProducts(data.products || [])
      } catch {
        setProducts([])
      } finally {
        setLoading(false)
      }
    }
    fetchProducts()
  }, [searchQuery])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setSearchQuery(searchInput)
  }

  function getSellerLocation(seller: ShopifyBoardProduct["seller"]) {
    return seller.shop_address || seller.city || seller.location || null
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search brand boards..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button type="submit">Search</Button>
      </form>

      {/* Info banner */}
      <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
        <Truck className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-foreground">Shipping available from verified sellers</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Brand new boards from verified retailers. These boards can be shipped or picked up at the listed shop location.
          </p>
        </div>
      </div>

      {products.length === 0 ? (
        <div className="text-center py-16">
          <Store className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-foreground">
            {searchQuery
              ? "No brand boards match your search"
              : "No brand boards available yet"}
          </h3>
          <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
            {searchQuery
              ? "Try a different search term."
              : "When verified sellers connect their Shopify stores, their surfboards will appear here."}
          </p>
          {searchQuery && (
            <Button
              variant="outline"
              className="mt-4 bg-transparent"
              onClick={() => {
                setSearchInput("")
                setSearchQuery("")
              }}
            >
              Clear Search
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((product) => {
            const price = parseFloat(
              product.priceRange.minVariantPrice.amount
            )
            const comparePrice = product.compareAtPriceRange?.minVariantPrice
              ? parseFloat(product.compareAtPriceRange.minVariantPrice.amount)
              : 0
            const hasDiscount = comparePrice > 0 && comparePrice > price
            const discountPercent = hasDiscount
              ? Math.round(((comparePrice - price) / comparePrice) * 100)
              : 0
            const shopifyUrl = `https://${product.seller.shopify_domain}/products/${product.handle}`
            const sellerLocation = getSellerLocation(product.seller)

            return (
              <Card
                key={`${product.seller.id}-${product.id}`}
                className="group overflow-hidden hover:shadow-lg transition-shadow h-full flex flex-col"
              >
                <a
                  href={shopifyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <div className="aspect-[4/5] relative bg-muted">
                    {product.featuredImage ? (
                      <Image
                        src={product.featuredImage.url || "/placeholder.svg"}
                        alt={
                          product.featuredImage.altText || product.title
                        }
                        fill
                        className="object-contain group-hover:scale-105 transition-transform duration-300"
                        style={{ objectFit: "contain" }}
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                        No Image
                      </div>
                    )}
                    <div className="absolute top-2 left-2 flex flex-col gap-1">
                      <Badge className="bg-black/70 text-white border-0">
                        New
                      </Badge>
                      {hasDiscount && (
                        <Badge className="bg-black/70 text-white border-0">
                          -{discountPercent}%
                        </Badge>
                      )}
                    </div>
                    {!product.availableForSale && (
                      <Badge className="absolute top-2 right-2 bg-black/70 text-white border-0">
                        Sold Out
                      </Badge>
                    )}
                    <Badge className="absolute bottom-2 right-2 bg-black/70 text-white border-0 text-xs">
                      <Truck className="h-3 w-3 mr-1" />
                      Ships
                    </Badge>
                  </div>
                </a>
                <CardContent className="p-4 flex flex-col flex-1">
                  {/* Seller info with location */}
                  <Link
                    href={`/sellers/${product.seller.id}`}
                    className="flex items-center gap-2 mb-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Avatar className="h-5 w-5">
                      <AvatarImage
                        src={product.seller.avatar_url || ""}
                      />
                      <AvatarFallback className="text-[8px] bg-primary/10 text-primary">
                        {product.seller.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate">
                      {product.seller.name}
                    </span>
                    {product.seller.verified && (
                      <CheckCircle2 className="h-3 w-3 text-primary flex-shrink-0" />
                    )}
                  </Link>

                  <a
                    href={shopifyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <h3 className="font-medium line-clamp-2 hover:text-primary transition-colors text-foreground">
                      {product.title}
                    </h3>
                  </a>

                  <div className="flex items-center gap-2 mt-2">
                    <p className="text-xl font-bold text-primary">
                      ${price.toFixed(2)}
                    </p>
                    {hasDiscount && (
                      <p className="text-sm text-muted-foreground line-through">
                        ${comparePrice.toFixed(2)}
                      </p>
                    )}
                  </div>

                  {/* Shop location */}
                  {sellerLocation && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                      <MapPin className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">{sellerLocation}</span>
                    </div>
                  )}

                  <div className="mt-auto pt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full bg-transparent"
                      asChild
                    >
                      <a
                        href={shopifyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ShoppingCart className="h-4 w-4 mr-2" />
                        Buy from Store
                        <ExternalLink className="h-3 w-3 ml-1" />
                      </a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
