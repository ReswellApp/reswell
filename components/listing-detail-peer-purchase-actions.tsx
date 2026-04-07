"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { CreditCard, Loader2, ShoppingCart } from "lucide-react"
import { Button } from "@/components/ui/button"
import { addCartItem } from "@/app/actions/cart"
import { peerListingCheckoutHref } from "@/lib/listing-href"
import { useOptionalAuthModal } from "@/components/auth/auth-modal-context"
import { safeRedirectPath } from "@/lib/auth/safe-redirect"
import { toast } from "sonner"

export function ListingDetailPeerPurchaseActions({
  listingId,
  checkoutListingParam,
  section,
  isLoggedIn,
}: {
  listingId: string
  /** Slug or id for `/checkout?listing=` */
  checkoutListingParam: string
  section: "surfboards"
  isLoggedIn: boolean
}) {
  const [loading, setLoading] = useState(false)
  const authModal = useOptionalAuthModal()
  const router = useRouter()
  const pathname = usePathname()
  const here = pathname || "/"
  const checkoutHref = peerListingCheckoutHref(section, checkoutListingParam)

  async function handleAddToCart(e: React.MouseEvent) {
    e.preventDefault()
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
      const r = await addCartItem(listingId)
      if (!r.ok) {
        toast.error(r.error ?? "Could not add to cart")
        return
      }
      toast.success("Saved to cart")
      window.dispatchEvent(new CustomEvent("cartUpdated"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
      {isLoggedIn ? (
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="min-h-touch flex-1 gap-2 justify-center"
          disabled={loading}
          onClick={handleAddToCart}
        >
          {loading ? (
            <Loader2 className="h-5 w-5 shrink-0 animate-spin" aria-hidden />
          ) : (
            <ShoppingCart className="h-5 w-5 shrink-0" aria-hidden />
          )}
          Add to cart
        </Button>
      ) : (
        <Button variant="outline" size="lg" className="min-h-touch flex-1 gap-2 justify-center" asChild>
          <Link
            href={`/auth/login?redirect=${encodeURIComponent(safeRedirectPath(here))}`}
            prefetch={false}
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
              if (!authModal) return
              e.preventDefault()
              authModal.openLogin(here)
            }}
          >
            <ShoppingCart className="h-5 w-5 shrink-0" aria-hidden />
            Add to cart
          </Link>
        </Button>
      )}

      <Button size="lg" className="min-h-touch flex-1 gap-2 justify-center" asChild>
        <Link href={checkoutHref} prefetch={false}>
          <CreditCard className="h-5 w-5 shrink-0" aria-hidden />
          Buy now
        </Link>
      </Button>
    </div>
  )
}
