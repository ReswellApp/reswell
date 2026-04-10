"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { ListingTileBasketSvg } from "@/components/listing-tile-basket-svg"
import { cn } from "@/lib/utils"
import { mergeIntoCart } from "@/lib/cart-storage"

const tileBtnClass = cn(
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-neutral-200 bg-white text-neutral-900 shadow-sm transition-colors",
  "hover:border-neutral-300 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400/40",
  "dark:border-neutral-600 dark:bg-neutral-950 dark:text-neutral-100 dark:hover:border-neutral-500 dark:hover:bg-neutral-900",
  "dark:focus-visible:ring-neutral-500/40",
  "disabled:pointer-events-none disabled:opacity-50",
)

function CheckSvg({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("h-4 w-4 shrink-0", className)}
      aria-hidden
    >
      <path
        d="M20 6L9 17l-5-5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Marketplace inventory (localStorage cart) — matches peer tile bag control styling. */
export function ListingTileShopInventoryCartIcon({
  item,
  className,
}: {
  item: {
    id: string
    name: string
    price: number
    image_url: string | null
    stock_quantity: number
  }
  className?: string
}) {
  const [loading, setLoading] = useState(false)
  const [added, setAdded] = useState(false)

  function handleClick(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (item.stock_quantity <= 0) {
      toast.error("Out of stock")
      return
    }
    setLoading(true)
    try {
      const result = mergeIntoCart(
        {
          id: item.id,
          name: item.name,
          price: item.price,
          image_url: item.image_url,
        },
        1,
        item.stock_quantity,
      )
      if (!result.ok) {
        toast.error("Not enough stock available")
        return
      }
      setAdded(true)
      toast.success("Added to cart")
      window.dispatchEvent(new CustomEvent("cartUpdated"))
      window.setTimeout(() => setAdded(false), 1600)
    } catch {
      toast.error("Could not add to cart")
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading || item.stock_quantity <= 0}
      aria-label="Add to cart"
      className={cn(
        tileBtnClass,
        added &&
          "border-neutral-300 bg-neutral-100 text-neutral-900 dark:border-neutral-500 dark:bg-neutral-800 dark:text-neutral-50",
        className,
      )}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin text-neutral-900 dark:text-neutral-100" aria-hidden />
      ) : added ? (
        <CheckSvg />
      ) : (
        <ListingTileBasketSvg />
      )}
    </button>
  )
}
