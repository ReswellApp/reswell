"use client"

import { useCallback } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { useOptionalAuthModal } from "@/components/auth/auth-modal-context"
import { authLandingHref } from "@/lib/auth/auth-landing-href"
import { NEWSLETTER_PROMO_DISCOUNT_PERCENT } from "@/lib/constants/newsletter-promo"
import { boardsBrowseLinkPrefetch } from "@/lib/boards-link-prefetch"
import { cn } from "@/lib/utils"

const buttonClassName = cn(
  "mt-3 h-10 rounded-md border border-black/10 bg-white px-5 text-sm font-semibold text-black shadow-sm",
  "hover:bg-white/90",
  "focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-listingHeart",
)

export function FooterNewsletterSignup() {
  const pathname = usePathname()
  const router = useRouter()
  const authModal = useOptionalAuthModal()

  const createAccount = useCallback(() => {
    if (authModal) {
      authModal.openSignUp(pathname)
      return
    }
    router.push(authLandingHref("/auth/sign-up", pathname))
  }, [authModal, pathname, router])

  return (
    <div className="max-w-md">
      <p className="text-sm font-semibold uppercase tracking-wide text-white/80">
        {NEWSLETTER_PROMO_DISCOUNT_PERCENT}% off your first{" "}
        <Link
          href="/boards"
          prefetch={boardsBrowseLinkPrefetch("/boards")}
          className="underline underline-offset-2 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-listingHeart rounded-sm"
        >
          order
        </Link>
      </p>
      <p className="mt-2 text-sm leading-relaxed text-white/75">
        Create an account and the code arrives in your welcome email.
      </p>
      <Button type="button" onClick={createAccount} className={buttonClassName}>
        Create account to receive promo code
      </Button>
    </div>
  )
}
