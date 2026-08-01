"use client"

import { useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { ShoppingCart, Check, Loader2 } from "lucide-react"
import { addCartItem } from "@/app/actions/cart"
import { trackMetaAddToCart } from "@/lib/meta/pixel-events"
import { collectMetaClientBrowserSignals } from "@/lib/meta/collect-client-browser-signals"
import { cn } from "@/lib/utils"
import { useOptionalAuthModal } from "@/components/auth/auth-modal-context"
import { safeRedirectPath } from "@/lib/auth/safe-redirect"
import { useClientSearchParams } from "@/hooks/use-client-search-params"

interface AddToCartButtonProps {
  item: {
    id: string
    name: string
    price: number
    image_url: string | null
    stock_quantity: number
  }
  quantity?: number
  isLoggedIn?: boolean
  variant?: "default" | "outline" | "secondary"
  size?: "default" | "sm" | "lg"
  className?: string
}

export function AddToCartButton({
  item,
  quantity = 1,
  isLoggedIn = false,
  variant = "default",
  size = "default",
  className,
}: AddToCartButtonProps) {
  const [loading, setLoading] = useState(false)
  const [added, setAdded] = useState(false)
  const authModal = useOptionalAuthModal()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useClientSearchParams()
  const here = `${pathname}${searchParams.toString() ? `?${searchParams}` : ""}`

  async function addToCart() {
    if (item.stock_quantity <= 0) {
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
        item.id,
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
        contentId: item.id,
        value: r.value,
        contentName: r.contentName,
        eventId: r.metaEventId,
      })
      setAdded(true)
      window.dispatchEvent(new CustomEvent("cartUpdated"))
      setTimeout(() => setAdded(false), 2000)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={addToCart}
      disabled={loading || item.stock_quantity <= 0}
      className={cn("transition-all", added && "bg-black hover:bg-neutral-800 text-white", className)}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : added ? (
        <>
          <Check className="h-4 w-4 mr-2" />
          Added
        </>
      ) : item.stock_quantity <= 0 ? (
        "Out of Stock"
      ) : (
        <>
          <ShoppingCart className="h-4 w-4 mr-2" />
          Add to Cart
        </>
      )}
    </Button>
  )
}
