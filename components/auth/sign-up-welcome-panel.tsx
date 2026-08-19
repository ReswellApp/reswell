"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { CheckCircle2, Loader2 } from "lucide-react"
import { SignUpGiveawayScreen } from "@/components/features/giveaways/sign-up-giveaway-screen"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { clearGoogleNewSignupCookie } from "@/lib/actions/clear-google-new-signup-cookie"
import { GOOGLE_NEW_SIGNUP_WELCOME_COMPLETED_KEY } from "@/lib/auth/google-sign-up-welcome"
import {
  isSellFlowReturnPath,
  isSellListingResumePath,
} from "@/lib/auth/is-sell-flow-return-path"
import { navigateAfterClientAuth } from "@/lib/auth/navigate-after-client-auth"
import { safeRedirectPath } from "@/lib/auth/safe-redirect"
import {
  getGiveawayBySlug,
  isGiveawayOpen,
  WIN_A_SURFBOARD_GIVEAWAY_SLUG,
} from "@/lib/giveaways/catalog"
import {
  clearGiveawayEntryIntent,
  parseGiveawayBrandParam,
  readGiveawayEntryIntent,
  writeGiveawayEntryIntent,
} from "@/lib/giveaways/intent-storage"
import { logGiveawayEvent } from "@/lib/giveaways/log-event"
import { giveawaySellHref } from "@/lib/giveaways/paths"
import { dismissGiveawaySignupPopup } from "@/lib/giveaways/signup-popup-storage"
import { submitGiveawayEntry } from "@/lib/giveaways/submit-entry"
import { setSellEntryPoint } from "@/lib/sell-flow/sell-entry-point"
import type { GiveawayPrizeBrandId } from "@/lib/types/giveaways"

const WELCOME_ITEMS = [
  "Browse boards, fins, wetsuits, and more from local sellers",
  "List gear in minutes",
  "Make offers, message sellers, and checkout securely",
] as const

function nextPathSearchParams(nextPath: string): URLSearchParams {
  const query = nextPath.includes("?") ? nextPath.slice(nextPath.indexOf("?") + 1) : ""
  return new URLSearchParams(query)
}

type SignUpWelcomePanelProps = {
  nextPath: string
  firstName?: string | null
  /** Shown under the headline — e.g. Google vs email sign-up. */
  subtitle: string
  /** Clears the OAuth callback cookie before continuing into the app. */
  clearGoogleNewSignupCookieOnContinue?: boolean
}

export function SignUpWelcomePanel({
  nextPath,
  firstName,
  subtitle,
  clearGoogleNewSignupCookieOnContinue = false,
}: SignUpWelcomePanelProps) {
  const router = useRouter()
  const headline = firstName ? `Welcome, ${firstName}!` : "Welcome to Reswell!"
  const goToSell = isSellFlowReturnPath(nextPath)
  const resumeListing = isSellListingResumePath(nextPath)
  const giveaway = getGiveawayBySlug(WIN_A_SURFBOARD_GIVEAWAY_SLUG)
  const showGiveawayOffer = Boolean(giveaway && isGiveawayOpen(giveaway) && !resumeListing)
  const continueStartedRef = useRef(false)
  const urlBrand = parseGiveawayBrandParam(nextPathSearchParams(nextPath).get("brand"))
  const [storedBrand, setStoredBrand] = useState<GiveawayPrizeBrandId | null>(null)
  const savedBrand = urlBrand ?? storedBrand

  const leaveWelcome = useCallback(
    (dest: string) => {
      if (continueStartedRef.current) return
      continueStartedRef.current = true
      window.setTimeout(() => {
        continueStartedRef.current = false
      }, 2500)

      void (async () => {
        const target = safeRedirectPath(dest)
        try {
          if (clearGoogleNewSignupCookieOnContinue) {
            try {
              sessionStorage.setItem(GOOGLE_NEW_SIGNUP_WELCOME_COMPLETED_KEY, "1")
            } catch {
              /* ignore */
            }
            try {
              await Promise.race([
                clearGoogleNewSignupCookie(),
                new Promise<void>((resolve) => {
                  window.setTimeout(resolve, 1200)
                }),
              ])
            } catch {
              /* still leave the welcome page */
            }
          }

          // /sell is public — hard-nav so a session wait or soft push cannot trap this screen.
          if (isSellFlowReturnPath(target)) {
            window.location.assign(target)
            return
          }
          await navigateAfterClientAuth(target, router)
        } catch {
          continueStartedRef.current = false
          window.location.assign(target)
        }
      })()
    },
    [clearGoogleNewSignupCookieOnContinue, router],
  )

  const handleContinue = useCallback(() => {
    leaveWelcome(nextPath)
  }, [leaveWelcome, nextPath])

  const handleListSurfboard = useCallback(
    (brand: GiveawayPrizeBrandId | null) => {
      const fromGiveawayCta = nextPathSearchParams(nextPath).get("from") === "giveaway"
      writeGiveawayEntryIntent({
        slug: WIN_A_SURFBOARD_GIVEAWAY_SLUG,
        brand,
        fromCta: fromGiveawayCta,
      })
      logGiveawayEvent({
        slug: WIN_A_SURFBOARD_GIVEAWAY_SLUG,
        event: "cta_click",
        surface: "popup",
        preferredBrand: brand,
      })
      setSellEntryPoint("giveaway")
      dismissGiveawaySignupPopup()
      void submitGiveawayEntry({
        slug: WIN_A_SURFBOARD_GIVEAWAY_SLUG,
        preferredBrand: brand,
        signedUpFromCta: fromGiveawayCta,
      })
      leaveWelcome(giveawaySellHref(brand))
    },
    [leaveWelcome, nextPath],
  )

  const handleGiveawayBrand = useCallback((brand: GiveawayPrizeBrandId) => {
    logGiveawayEvent({
      slug: WIN_A_SURFBOARD_GIVEAWAY_SLUG,
      event: "brand_click",
      surface: "popup",
      preferredBrand: brand,
    })
  }, [])

  const handleDeclineGiveaway = useCallback(() => {
    clearGiveawayEntryIntent()
    dismissGiveawaySignupPopup()
    leaveWelcome("/")
  }, [leaveWelcome])

  useEffect(() => {
    if (urlBrand) return
    const stored = readGiveawayEntryIntent()?.brand ?? null
    if (stored) setStoredBrand(stored)
  }, [urlBrand])

  useEffect(() => {
    if (!goToSell || showGiveawayOffer) return
    handleContinue()
    const backup = window.setTimeout(() => {
      window.location.assign(safeRedirectPath(nextPath))
    }, 4000)
    return () => window.clearTimeout(backup)
  }, [goToSell, handleContinue, nextPath, showGiveawayOffer])

  if (showGiveawayOffer && giveaway) {
    return (
      <SignUpGiveawayScreen
        key={savedBrand ?? "choose"}
        giveaway={giveaway}
        firstName={firstName}
        initialBrand={savedBrand}
        hideBrandPicker={Boolean(savedBrand)}
        onBrandChange={handleGiveawayBrand}
        onList={handleListSurfboard}
        onDecline={handleDeclineGiveaway}
      />
    )
  }

  if (goToSell) {
    return (
      <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-md">
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-listingHeart/10">
                <Loader2 className="h-7 w-7 animate-spin text-listingHeart" aria-hidden />
              </div>
              <CardTitle className="text-2xl">
                {resumeListing ? "Taking you back to your listing" : "Taking you to list your gear"}
              </CardTitle>
              <CardDescription className="text-base">
                {resumeListing
                  ? "Your account is ready. Next we will open your listing so you can publish it."
                  : "Your account is ready. Next we will open the sell flow so you can list."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                type="button"
                className="h-12 w-full rounded-full bg-listingHeart text-white hover:bg-[#2a4170]"
                onClick={handleContinue}
              >
                {resumeListing ? "Continue to listing" : "Continue to sell"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-listingHeart/10">
              <CheckCircle2 className="h-7 w-7 text-listingHeart" aria-hidden />
            </div>
            <CardTitle className="text-2xl">{headline}</CardTitle>
            <CardDescription className="text-base">{subtitle}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <ul className="space-y-3 text-sm text-muted-foreground">
              {WELCOME_ITEMS.map((item) => (
                <li key={item} className="flex gap-2">
                  <CheckCircle2
                    className="mt-0.5 h-4 w-4 shrink-0 text-listingHeart"
                    aria-hidden
                  />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <Button
              type="button"
              className="h-12 w-full rounded-full bg-listingHeart text-white hover:bg-[#2a4170]"
              onClick={handleContinue}
            >
              Start exploring
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Need help?{" "}
              <Link href="/help" className="underline underline-offset-4 hover:text-foreground">
                Visit the Help Center
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
