"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Minus, Plus, ShoppingCart, Check, Loader2 } from "lucide-react"
import { mergeIntoCart } from "@/lib/cart-storage"

interface QuantitySelectorProps {
  productId: string
  maxQuantity: number
  /** When provided (e.g. from listing page), skip API fetch and use this for cart */
  item?: {
    id: string
    name: string
    price: number
    image_url: string | null
  }
}

interface InventoryItem {
  id: string
  name: string
  price: number
  image_url: string | null
}

export function QuantitySelector({ productId, maxQuantity, item: itemProp }: QuantitySelectorProps) {
  const [quantity, setQuantity] = useState(1)
  const [loading, setLoading] = useState(false)
  const [added, setAdded] = useState(false)
  const [product, setProduct] = useState<InventoryItem | null>(itemProp ?? null)

  useEffect(() => {
    if (itemProp) {
      setProduct(itemProp)
      return
    }
    async function fetchProduct() {
      try {
        const response = await fetch(`/api/products/${productId}`)
        if (response.ok) {
          const data = await response.json()
          setProduct(data)
        }
      } catch {
        // Product details will be fetched on add to cart
      }
    }
    fetchProduct()
  }, [productId, itemProp])

  function incrementQuantity() {
    if (quantity < maxQuantity) {
      setQuantity(quantity + 1)
    }
  }

  function decrementQuantity() {
    if (quantity > 1) {
      setQuantity(quantity - 1)
    }
  }

  function addToCart() {
    setLoading(true)

    try {
      const result = mergeIntoCart(
        {
          id: productId,
          name: product?.name || "Product",
          price: product?.price || 0,
          image_url: product?.image_url ?? null,
        },
        quantity,
        maxQuantity,
      )
      if (!result.ok) {
        toast.error("Not enough stock available")
        setLoading(false)
        return
      }

      setAdded(true)
      toast.success(`Added ${quantity} item${quantity > 1 ? "s" : ""} to cart`)

      setTimeout(() => {
        setAdded(false)
        setQuantity(1)
      }, 2000)
    } catch {
      toast.error("Failed to add to cart")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium">Quantity:</span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={decrementQuantity}
            disabled={quantity <= 1}
            className="h-8 w-8 bg-transparent"
          >
            <Minus className="h-4 w-4" />
          </Button>
          <span className="w-12 text-center font-medium">{quantity}</span>
          <Button
            variant="outline"
            size="icon"
            onClick={incrementQuantity}
            disabled={quantity >= maxQuantity}
            className="h-8 w-8"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <span className="text-sm text-muted-foreground">
          ({maxQuantity} available)
        </span>
      </div>

      <Button
        size="lg"
        onClick={addToCart}
        disabled={loading || maxQuantity <= 0}
        className={`w-full ${added ? "bg-black hover:bg-neutral-800" : ""}`}
      >
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : added ? (
          <>
            <Check className="h-5 w-5 mr-2" />
            Added to Cart
          </>
        ) : (
          <>
            <ShoppingCart className="h-5 w-5 mr-2" />
            Add to Cart - ${((product?.price || 0) * quantity).toFixed(2)}
          </>
        )}
      </Button>
    </div>
  )
}
