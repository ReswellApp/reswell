"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useSignInGate } from "@/components/auth/use-sign-in-gate"
import { useHydratedIsLoggedIn } from "@/components/features/listings/listing-viewer-provider"
import { ListingTileBasketSvg } from "@/components/listing-tile-basket-svg"
import { cn } from "@/lib/utils"

const tileBtnClass = cn(
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-neutral-200 bg-white text-neutral-900 shadow-sm transition-colors",
  "hover:border-neutral-300 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400/40",
  "dark:border-neutral-600 dark:bg-neutral-950 dark:text-neutral-100 dark:hover:border-neutral-500 dark:hover:bg-neutral-900",
  "dark:focus-visible:ring-neutral-500/40",
)

/**
 * Same basket styling as {@link ListingTileAddToCartIcon} but navigates to P2P checkout
 * (`/checkout?listing=…`). Shop “new” inventory uses the cart in localStorage instead.
 * Guests open the auth modal with redirect back to `checkoutHref` after sign-in.
 */
export function ListingTileCheckoutBasketIcon({
  checkoutHref,
  loginHref,
  isLoggedIn,
  className,
}: {
  checkoutHref: string
  /** Fallback URL when the modal is unavailable (e.g. new tab). */
  loginHref: string
  isLoggedIn: boolean
  className?: string
}) {
  const requireSignIn = useSignInGate()
  const loggedIn = useHydratedIsLoggedIn(isLoggedIn)
  const router = useRouter()

  return (
    <Link
      href={loggedIn ? checkoutHref : loginHref}
      prefetch={false}
      onClick={(e) => {
        e.stopPropagation()
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
        if (loggedIn) return
        e.preventDefault()
        void requireSignIn(checkoutHref).then((ok) => {
          if (ok) router.push(checkoutHref)
        })
      }}
      className={cn(tileBtnClass, className)}
      aria-label={loggedIn ? "Go to checkout" : "Sign in to checkout"}
    >
      <ListingTileBasketSvg />
    </Link>
  )
}
