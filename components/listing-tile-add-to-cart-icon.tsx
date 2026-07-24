"use client"

import {
  ListingTileShopInventoryCartIcon,
} from "@/components/listing-tile-shop-inventory-cart-icon"

export type ListingTileCartItem = {
  id: string
  name: string
  price: number
  image_url: string | null
  stock_quantity: number
}

type ListingTileAddToCartIconProps = {
  item: ListingTileCartItem
  isLoggedIn?: boolean
  className?: string
}

/** @deprecated Prefer ListingTileShopInventoryCartIcon — kept for call-site compatibility. */
export function ListingTileAddToCartIcon({
  item,
  isLoggedIn = false,
  className,
}: ListingTileAddToCartIconProps) {
  if (item.stock_quantity <= 0) return null
  return (
    <ListingTileShopInventoryCartIcon item={item} isLoggedIn={isLoggedIn} className={className} />
  )
}
