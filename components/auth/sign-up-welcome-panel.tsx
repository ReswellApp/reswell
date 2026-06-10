"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { CheckCircle2 } from "lucide-react"
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
import { navigateAfterClientAuth } from "@/lib/auth/navigate-after-client-auth"

const WELCOME_ITEMS = [
  "Browse surfboards and gear from local sellers",
  "List your boards and wetsuits in minutes",
  "Make offers, message sellers, and checkout securely",
] as const

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

  const handleContinue = () => {
    void (async () => {
      if (clearGoogleNewSignupCookieOnContinue) {
        try {
          sessionStorage.setItem(GOOGLE_NEW_SIGNUP_WELCOME_COMPLETED_KEY, "1")
        } catch {
          /* ignore */
        }
        await clearGoogleNewSignupCookie()
      }
      await navigateAfterClientAuth(nextPath, router)
    })()
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
