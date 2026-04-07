"use client"

import { useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { addCartItem } from "@/app/actions/cart"
import { ListingTileBasketSvg } from "@/components/listing-tile-basket-svg"
import { cn } from "@/lib/utils"
import { useOptionalAuthModal } from "@/components/auth/auth-modal-context"
import { safeRedirectPath } from "@/lib/auth/safe-redirect"

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

export function ListingTileAddToCartServerIcon({
  listingId,
  isLoggedIn,
  className,
}: {
  listingId: string
  isLoggedIn: boolean
  className?: string
}) {
  const [loading, setLoading] = useState(false)
  const [added, setAdded] = useState(false)
  const authModal = useOptionalAuthModal()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const here = `${pathname}${searchParams.toString() ? `?${searchParams}` : ""}`

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
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
        toast.error(r.error ?? "Could not save to cart")
        return
      }
      setAdded(true)
      toast.success("Saved to cart")
      window.dispatchEvent(new CustomEvent("cartUpdated"))
      window.setTimeout(() => setAdded(false), 1600)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      aria-label={isLoggedIn ? "Add to cart" : "Sign in to save to cart"}
      className={cn(
        tileBtnClass,
        isLoggedIn &&
          added &&
          "border-neutral-300 bg-neutral-100 text-neutral-900 dark:border-neutral-500 dark:bg-neutral-800 dark:text-neutral-50",
        className,
      )}
    >
      {isLoggedIn && loading ? (
        <Loader2 className="h-4 w-4 animate-spin text-neutral-900 dark:text-neutral-100" aria-hidden />
      ) : isLoggedIn && added ? (
        <CheckSvg />
      ) : (
        <ListingTileBasketSvg />
      )}
    </button>
  )
}
