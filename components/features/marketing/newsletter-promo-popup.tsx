"use client"

import { useCallback, useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import type { User } from "@supabase/supabase-js"
import { X } from "lucide-react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useOptionalAuthModal } from "@/components/auth/auth-modal-context"
import { BRAND_NEAR_BLACK } from "@/lib/brand-colors"
import { NEWSLETTER_POPUP_DELAY_MS, NEWSLETTER_PROMO_DISCOUNT_PERCENT } from "@/lib/constants/newsletter-promo"
import {
  getNewsletterPopupStorageState,
  setNewsletterPopupStorageState,
  shouldShowNewsletterPopup,
} from "@/lib/newsletter-promo-popup-storage"
import { authLandingHref } from "@/lib/auth/auth-landing-href"
import { cn } from "@/lib/utils"
import { useNewsletterPromoVisitorAuth } from "@/components/features/marketing/hooks/use-newsletter-promo-visitor-auth"

export function NewsletterPromoPopup({ serverUser = null }: { serverUser?: User | null }) {
  const pathname = usePathname()
  const router = useRouter()
  const authModal = useOptionalAuthModal()
  const { authResolved, isLoggedIn } = useNewsletterPromoVisitorAuth(serverUser)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (isLoggedIn) {
      setOpen(false)
    }
  }, [isLoggedIn])

  useEffect(() => {
    if (!authResolved || isLoggedIn) return
    if (!shouldShowNewsletterPopup(pathname)) return
    if (getNewsletterPopupStorageState()) return

    const timer = window.setTimeout(() => {
      if (getNewsletterPopupStorageState()) return
      setOpen(true)
    }, NEWSLETTER_POPUP_DELAY_MS)

    return () => window.clearTimeout(timer)
  }, [pathname, isLoggedIn, authResolved])

  const dismiss = useCallback(() => {
    setNewsletterPopupStorageState("dismissed")
    setOpen(false)
  }, [])

  const createAccount = useCallback(() => {
    setOpen(false)
    if (authModal) {
      authModal.openSignUp(pathname)
      return
    }
    router.push(authLandingHref("/auth/sign-up", pathname))
  }, [authModal, pathname, router])

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        dismiss()
        return
      }
      setOpen(true)
    },
    [dismiss],
  )

  if (!open || isLoggedIn || !authResolved) return null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        overlayClassName="bg-black/50"
        className={cn(
          "max-w-[380px] gap-0 overflow-hidden border border-black/10 bg-white p-0 shadow-lg sm:rounded-xl",
        )}
      >
        <DialogTitle className="sr-only">
          Create an account to receive {NEWSLETTER_PROMO_DISCOUNT_PERCENT}% off
        </DialogTitle>

        <div className="relative px-6 pb-6 pt-7 sm:px-7 sm:pb-7 sm:pt-8">
          <button
            type="button"
            onClick={dismiss}
            className="absolute right-4 top-4 rounded-sm p-1 text-black/50 transition hover:text-black"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>

          <p className="pr-8 font-headline text-[1.75rem] font-bold leading-tight tracking-[-0.03em] text-black">
            {NEWSLETTER_PROMO_DISCOUNT_PERCENT}% off — first order
          </p>
          <p className="mt-2 text-[14px] leading-relaxed text-black/65">
            Create an account and we&apos;ll email your code. Works on any board or fin — 30 days to use it.
          </p>

          <div className="mt-6 space-y-3">
            <Button
              type="button"
              onClick={createAccount}
              className="h-11 w-full rounded-md border-0 text-[14px] font-medium text-white shadow-none hover:opacity-90"
              style={{ backgroundColor: BRAND_NEAR_BLACK }}
            >
              Create account to receive promo code
            </Button>
            <button
              type="button"
              onClick={dismiss}
              className="w-full py-1 text-center text-[13px] text-black/45 underline-offset-2 hover:text-black/70 hover:underline"
            >
              No thanks
            </button>
          </div>

          <p className="mt-5 text-[11px] leading-relaxed text-black/40">
            Your {NEWSLETTER_PROMO_DISCOUNT_PERCENT}% code is sent in the welcome email after you create an account.
            One active code per email. Item price only.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
