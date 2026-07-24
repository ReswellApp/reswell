"use client"

import { useState, useEffect } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Minus, Plus, ShoppingCart, Check, Loader2 } from "lucide-react"
import { addCartItem } from "@/app/actions/cart"
import { getInventoryProductById } from "@/app/actions/marketplace"
import { trackMetaAddToCart } from "@/lib/meta/pixel-events"
import { collectMetaClientBrowserSignals } from "@/lib/meta/collect-client-browser-signals"
import { useOptionalAuthModal } from "@/components/auth/auth-modal-context"
import { safeRedirectPath } from "@/lib/auth/safe-redirect"

interface QuantitySelectorProps {
  productId: string
  maxQuantity: number
  isLoggedIn?: boolean
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

export function QuantitySelector({
  productId,
  maxQuantity,
  isLoggedIn = false,
  item: itemProp,
}: QuantitySelectorProps) {
  const [quantity, setQuantity] = useState(1)
  const [loading, setLoading] = useState(false)
  const [added, setAdded] = useState(false)
  const [product, setProduct] = useState<InventoryItem | null>(itemProp ?? null)
  const authModal = useOptionalAuthModal()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const here = `${pathname}${searchParams.toString() ? `?${searchParams}` : ""}`

  useEffect(() => {
    if (itemProp) {
      setProduct(itemProp)
      return
    }
    async function fetchProduct() {
      try {
        const result = await getInventoryProductById(productId)
        if ("product" in result) {
          setProduct(result.product)
        }
      } catch {
        // Product details will be fetched on add to cart
      }
    }
    void fetchProduct()
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

  async function addToCart() {
    if (maxQuantity <= 0) {
      toast.error("Out of stock")
      return
    }
    if (!isLoggedIn) {
      const safe = safeRedirectPath(here)
      if (authModal) {
        authModal.openLogin(here)
      } else {
        router.push(`/auth/login?redirect=${encodeURIComponent(safe)}`)
      }
      return
    }
    setLoading(true)
    try {
      const browserSignals = await collectMetaClientBrowserSignals().catch(() => ({
        fbc: null,
        fbp: null,
      }))
      const r = await addCartItem(
        productId,
        {
          fbc: browserSignals.fbc ?? undefined,
          fbp: browserSignals.fbp ?? undefined,
        },
        quantity,
      )
      if (!r.ok) {
        toast.error(r.error ?? "Failed to add to cart")
        return
      }
      trackMetaAddToCart({
        contentId: productId,
        value: r.value,
        contentName: r.contentName,
        eventId: r.metaEventId,
      })
      setAdded(true)
      window.dispatchEvent(new CustomEvent("cartUpdated"))
      setTimeout(() => {
        setAdded(false)
        setQuantity(1)
      }, 2000)
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
        <span className="text-sm text-muted-foreground">({maxQuantity} available)</span>
      </div>

      <Button
        size="lg"
        onClick={addToCart}
        disabled={loading || maxQuantity <= 0}
        className={`w-full h-12 rounded-xl text-base font-semibold shadow-sm ${added ? "bg-black hover:bg-neutral-800" : ""}`}
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
