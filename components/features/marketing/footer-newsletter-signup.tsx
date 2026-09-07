"use client"

import { useCallback, useState } from "react"
import Link from "next/link"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NEWSLETTER_PROMO_DISCOUNT_PERCENT } from "@/lib/constants/newsletter-promo"
import { setNewsletterPopupStorageState } from "@/lib/newsletter-promo-popup-storage"
import { boardsBrowseLinkPrefetch } from "@/lib/boards-link-prefetch"
import { cn } from "@/lib/utils"

type SignupPhase = "form" | "success"

const fieldClassName = cn(
  "h-10 rounded-md border-0 bg-white text-[15px] text-black shadow-sm",
  "placeholder:text-black/40",
  "focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-listingHeart",
)

const buttonClassName = cn(
  "h-10 shrink-0 rounded-md border border-black/10 bg-white px-5 text-sm font-semibold text-black shadow-sm",
  "hover:bg-white/90",
  "focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-listingHeart",
)

export function FooterNewsletterSignup() {
  const [phase, setPhase] = useState<SignupPhase>("form")
  const [email, setEmail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

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
          alreadySignedUp?: boolean
        }
        if (!res.ok) {
          if (data.alreadySignedUp) {
            setNewsletterPopupStorageState("subscribed")
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

  return (
    <div className="max-w-md">
      <p className="text-sm font-semibold uppercase tracking-wide text-white/80">
        Get updates on{" "}
        <Link
          href="/boards"
          prefetch={boardsBrowseLinkPrefetch("/boards")}
          className="underline underline-offset-2 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-listingHeart rounded-sm"
        >
          gear deals
        </Link>
      </p>

      {phase === "success" ? (
        <p className="mt-3 text-sm leading-relaxed text-white/75">
          You&apos;re in. Check your inbox for {NEWSLETTER_PROMO_DISCOUNT_PERCENT}% off — any listing, 30
          days.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="mt-3">
          <div className="flex gap-2">
            <label htmlFor="footer-newsletter-email" className="sr-only">
              Email address
            </label>
            <Input
              id="footer-newsletter-email"
              type="email"
              autoComplete="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
              className={cn(fieldClassName, "min-w-0 flex-1")}
            />
            <Button type="submit" disabled={submitting} className={buttonClassName}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  <span className="sr-only">Subscribing</span>
                </>
              ) : (
                "Subscribe"
              )}
            </Button>
          </div>
          {error ? (
            <p className="mt-2 text-[13px] text-white/90" role="alert">
              {error}
            </p>
          ) : null}
          <p className="mt-2 text-[11px] leading-relaxed text-white/45">
            Opt in to marketing emails from Reswell. Unsubscribe anytime.
          </p>
        </form>
      )}
    </div>
  )
}
