"use client"

import Image from "next/image"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { AddToCartButton } from "@/components/add-to-cart-button"
import { listingProductCardClassName } from "@/lib/listing-card-styles"

export interface MarketplaceNewItem {
  id: string
  title: string
  price: number
  image_url: string | null
  stock_quantity: number
}

export function MarketplaceNewGrid({ items }: { items: MarketplaceNewItem[] }) {
  if (items.length === 0) return null

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {items.map((item) => (
        <Card key={item.id} className={listingProductCardClassName}>
          <Link href={`/shop/${item.id}`}>
            <div className="aspect-square relative bg-muted">
              {item.image_url ? (
                <Image
                  src={item.image_url}
                  alt={item.title}
                  fill
                  className="object-contain group-hover:scale-105 transition-transform duration-300"
                  style={{ objectFit: "contain" }}
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                  No Image
                </div>
              )}
            </div>
          </Link>
          <CardContent className="p-3">
            <Link href={`/shop/${item.id}`}>
              <h3 className="text-sm font-medium line-clamp-2 hover:text-primary transition-colors text-foreground">
                {item.title}
              </h3>
            </Link>
            <p className="text-base font-bold text-black dark:text-white mt-1">
              ${Number(item.price).toFixed(2)}
            </p>
            <div className="mt-2">
              <AddToCartButton
                item={{
                  id: item.id,
                  name: item.title,
                  price: item.price,
                  image_url: item.image_url,
                  stock_quantity: item.stock_quantity,
                }}
                variant="default"
                size="sm"
                className="w-full"
              />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
