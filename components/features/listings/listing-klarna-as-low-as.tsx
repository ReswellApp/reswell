"use client"

import { useState, type MouseEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { addCartItem } from "@/app/actions/cart"
import { useOptionalAuthModal } from "@/components/auth/auth-modal-context"
import { safeRedirectPath } from "@/lib/auth/safe-redirect"
import { cartAddListingHref } from "@/lib/listing-href"
import { collectMetaClientBrowserSignals } from "@/lib/meta/collect-client-browser-signals"
import { trackMetaAddToCart } from "@/lib/meta/pixel-events"
import { cn } from "@/lib/utils"

/** PDP financing hint — no calculated monthly amount. Klarna terms vary at checkout. */
export function ListingKlarnaAsLowAs({
  listingId,
  isLoggedIn,
  className,
}: {
  listingId: string
  isLoggedIn: boolean
  className?: string
}) {
  const [pending, setPending] = useState(false)
  const router = useRouter()
  const authModal = useOptionalAuthModal()
  const cartAddHref = cartAddListingHref(listingId)

  function openLoginGate() {
    if (authModal) {
      authModal.openLogin(cartAddHref)
      return
    }
    router.push(`/auth/login?redirect=${encodeURIComponent(safeRedirectPath(cartAddHref))}`)
  }

  async function handleKlarnaClick(e: MouseEvent<HTMLAnchorElement>) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
    e.preventDefault()
    if (!isLoggedIn) {
      openLoginGate()
      return
    }
    if (pending) return
    setPending(true)
    try {
      const browserSignals = await collectMetaClientBrowserSignals().catch(() => ({
        fbc: null,
        fbp: null,
      }))
      const r = await addCartItem(listingId, {
        fbc: browserSignals.fbc ?? undefined,
        fbp: browserSignals.fbp ?? undefined,
      })
      if (!r.ok) {
        toast.error(r.error ?? "Could not add to cart")
        return
      }
      trackMetaAddToCart({
        contentId: listingId,
        value: r.value,
        contentName: r.contentName,
        eventId: r.metaEventId,
      })
      window.dispatchEvent(new CustomEvent("cartUpdated"))
      router.push("/cart")
    } finally {
      setPending(false)
    }
  }

  return (
    <p className={cn("text-[14px] leading-snug text-foreground", className)}>
      As low as monthly payments with{" "}
      <Link
        href={cartAddHref}
        className="font-semibold tracking-tight underline underline-offset-2 hover:no-underline"
        aria-busy={pending}
        onClick={handleKlarnaClick}
      >
        Klarna
      </Link>
      .{" "}
      <Link
        href="/help/buying/how-do-i-pay"
        className="underline underline-offset-2 hover:no-underline"
      >
        Learn more
      </Link>
    </p>
  )
}
