"use client"

import { useCallback, useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import type { User } from "@supabase/supabase-js"
import { Loader2, X } from "lucide-react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { BRAND_NEAR_BLACK } from "@/lib/brand-colors"
import { NEWSLETTER_POPUP_DELAY_MS, NEWSLETTER_PROMO_DISCOUNT_PERCENT } from "@/lib/constants/newsletter-promo"
import {
  getNewsletterPopupStorageState,
  setNewsletterPopupStorageState,
  shouldShowNewsletterPopup,
} from "@/lib/newsletter-promo-popup-storage"
import { cn } from "@/lib/utils"
import { useNewsletterPromoVisitorAuth } from "@/components/features/marketing/hooks/use-newsletter-promo-visitor-auth"

type PopupPhase = "idle" | "form" | "success"

export function NewsletterPromoPopup({ serverUser = null }: { serverUser?: User | null }) {
  const pathname = usePathname()
  const { authResolved, isLoggedIn } = useNewsletterPromoVisitorAuth(serverUser)
  const [open, setOpen] = useState(false)
  const [phase, setPhase] = useState<PopupPhase>("form")
  const [email, setEmail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

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
      setPhase("form")
    }, NEWSLETTER_POPUP_DELAY_MS)

    return () => window.clearTimeout(timer)
  }, [pathname, isLoggedIn, authResolved])

  const dismiss = useCallback(() => {
    setNewsletterPopupStorageState("dismissed")
    setOpen(false)
  }, [])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setError(null)
      const trimmed = email.trim()
      if (!trimmed) {
        setError("Enter your email address.")
        return
      }

      setSubmitting(true)
      try {
        const res = await fetch("/api/promo/newsletter-signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: trimmed }),
        })
        const data = (await res.json()) as {
          error?: string
          message?: string
          alreadySignedUp?: boolean
        }
        if (!res.ok) {
          if (data.alreadySignedUp) {
            setNewsletterPopupStorageState("subscribed")
            setError(data.error ?? "This email already signed up.")
            return
          }
          setError(data.error ?? "Something went wrong. Try again.")
          return
        }
        setNewsletterPopupStorageState("subscribed")
        setPhase("success")
      } catch {
        setError("Network error. Check your connection and try again.")
      } finally {
        setSubmitting(false)
      }
    },
    [email],
  )

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        if (phase === "success") {
          setOpen(false)
          return
        }
        dismiss()
        return
      }
      setOpen(true)
    },
    [dismiss, phase],
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
          {phase === "success"
            ? `Check your email for ${NEWSLETTER_PROMO_DISCOUNT_PERCENT}% off`
            : `Get ${NEWSLETTER_PROMO_DISCOUNT_PERCENT}% off your first order`}
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

          {phase === "success" ? (
            <div className="space-y-4 pr-8">
              <p className="font-headline text-[1.75rem] font-bold leading-tight tracking-[-0.03em] text-black">
                You&apos;re in
              </p>
              <p className="text-[14px] leading-relaxed text-black/65">
                Check your email for {NEWSLETTER_PROMO_DISCOUNT_PERCENT}% off — any listing, 30 days. Happy hunting.
              </p>
              <Button
                type="button"
                className="mt-2 h-11 w-full rounded-md border-0 bg-black text-[14px] font-medium text-white hover:bg-black/85"
                onClick={() => setOpen(false)}
              >
                Keep scrolling
              </Button>
            </div>
          ) : (
            <>
              <p className="pr-8 font-headline text-[1.75rem] font-bold leading-tight tracking-[-0.03em] text-black">
                {NEWSLETTER_PROMO_DISCOUNT_PERCENT}% off — first order
              </p>
              <p className="mt-2 text-[14px] leading-relaxed text-black/65">
                Something on here you want to ride? Leave your email and we&apos;ll send a code. Works on any board or
                fin — 30 days to use it.
              </p>

              <form onSubmit={handleSubmit} className="mt-6 space-y-3">
                <label htmlFor="newsletter-promo-email" className="sr-only">
                  Email address
                </label>
                <Input
                  id="newsletter-promo-email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={submitting}
                  className="h-11 rounded-md border-black/15 bg-white text-[15px] text-black placeholder:text-black/35 focus-visible:ring-black/20"
                />
                {error ? (
                  <p className="text-[13px] text-black/80" role="alert">
                    {error}
                  </p>
                ) : null}
                <Button
                  type="submit"
                  disabled={submitting}
                  className="h-11 w-full rounded-md border-0 text-[14px] font-medium text-white shadow-none hover:opacity-90"
                  style={{ backgroundColor: BRAND_NEAR_BLACK }}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                      Sending…
                    </>
                  ) : (
                    "Get my code"
                  )}
                </Button>
                <button
                  type="button"
                  onClick={dismiss}
                  className="w-full py-1 text-center text-[13px] text-black/45 underline-offset-2 hover:text-black/70 hover:underline"
                >
                  No thanks
                </button>
              </form>

              <p className="mt-5 text-[11px] leading-relaxed text-black/40">
                By entering your email and tapping &ldquo;Get my code,&rdquo; you opt in to marketing emails from
                Reswell. One active code per email. Item price only. Unsubscribe anytime.
              </p>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
