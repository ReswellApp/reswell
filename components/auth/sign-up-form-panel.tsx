"use client"

import { useEffect, useState, type ReactNode } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Eye, EyeOff } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { AuthFormOrDivider } from "@/components/auth/auth-form-or-divider"
import { GoogleOAuthButton } from "@/components/auth/google-oauth-button"
import { HEADER_AUTH_REFRESH_EVENT } from "@/lib/auth/header-auth-refresh"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { navigateAfterClientAuth } from "@/lib/auth/navigate-after-client-auth"
import { safeRedirectPath } from "@/lib/auth/safe-redirect"
import { authLandingHref } from "@/lib/auth/auth-landing-href"
import {
  SIGN_UP_PASSWORD_HINT,
  validateSignUpPassword,
} from "@/lib/auth/sign-up-password-validation"
import { waitForClientSession } from "@/lib/auth/wait-for-client-session"
import { buildEmailSignUpSuccessPath } from "@/lib/google-ads/sign-up-success-path"
import { resolveSignUpDisplayName } from "@/lib/auth/sign-up-display-name"
import { cn } from "@/lib/utils"

function RequiredMark() {
  return (
    <span className="text-destructive" aria-hidden="true">
      *
    </span>
  )
}

export function SignUpFormPanel({
  variant = "page",
  redirectTo = "/",
  footerLogin,
  onSignUpSuccess,
  googleAutoStart = false,
  initialMarketingOptIn,
}: {
  variant?: "page" | "modal" | "landing"
  redirectTo?: string
  footerLogin?: ReactNode
  onSignUpSuccess?: () => void
  googleAutoStart?: boolean
  /** From OAuth handoff URL (`?marketing=1`) when auto-starting Google sign-up. */
  initialMarketingOptIn?: boolean
}) {
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [marketingOptIn, setMarketingOptIn] = useState(initialMarketingOptIn ?? true)
  const [acceptedTerms, setAcceptedTerms] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    const dest = safeRedirectPath(redirectTo)
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      if (variant === "modal") {
        onSignUpSuccess?.()
        return
      }
      await navigateAfterClientAuth(dest, router)
    })
  }, [onSignUpSuccess, redirectTo, router, variant])

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!acceptedTerms) {
      setError("Please accept Reswell's Terms of Use and Privacy Policy to continue.")
      return
    }

    const trimmedFirst = firstName.trim()
    const trimmedLast = lastName.trim()
    if (!trimmedFirst || !trimmedLast) {
      setError("First name and last name are required.")
      return
    }

    const displayNameResult = resolveSignUpDisplayName({
      username,
      firstName: trimmedFirst,
      lastName: trimmedLast,
      email,
    })
    if (!displayNameResult.ok) {
      setError(displayNameResult.error)
      return
    }
    const displayName = displayNameResult.displayName

    const passwordCheck = validateSignUpPassword(password)
    if (!passwordCheck.valid) {
      setError(passwordCheck.error)
      return
    }

    const supabase = createClient()
    setIsLoading(true)

    try {
      let siteOrigin = window.location.origin
      const devOverride = process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL?.trim()
      if (devOverride && process.env.NODE_ENV === "development") {
        try {
          const u = new URL(devOverride.startsWith("http") ? devOverride : `https://${devOverride}`)
          if (u.hostname === "localhost" || u.hostname === "127.0.0.1") {
            siteOrigin = `${u.protocol}//${u.host}`
          }
        } catch {
          /* keep window.location.origin */
        }
      }
      const postAuthDest = safeRedirectPath(redirectTo)
      const { data: signData, error: signError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${siteOrigin}/auth/confirm?next=${encodeURIComponent(postAuthDest)}`,
          data: {
            display_name: displayName,
            first_name: trimmedFirst,
            last_name: trimmedLast,
            marketing_opt_in: marketingOptIn,
            ...(username.trim() ? { username: username.trim() } : {}),
          },
        },
      })
      if (signError) throw signError
      if (signData.session?.user) {
        try {
          await fetch("/api/integrations/klaviyo/new-account-created", {
            method: "POST",
            credentials: "include",
            headers: {
              Authorization: `Bearer ${signData.session.access_token}`,
            },
          })
        } catch {
          /* Klaviyo must not block signup */
        }
        await waitForClientSession({ supabase })
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event(HEADER_AUTH_REFRESH_EVENT))
        }
        onSignUpSuccess?.()
        window.location.assign(buildEmailSignUpSuccessPath(redirectTo))
      } else {
        onSignUpSuccess?.()
        router.push(authLandingHref("/auth/login", redirectTo))
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  const signInLink =
    footerLogin ?? (
      <Link
        href={authLandingHref("/auth/login", redirectTo)}
        className="font-medium text-foreground underline underline-offset-4 hover:text-cerulean"
      >
        Sign in
      </Link>
    )

  const showPageHeader = variant !== "modal"
  const isLanding = variant === "landing"

  const inner = (
    <div className="flex flex-col gap-8">
      {showPageHeader ? (
        <div className={cn(isLanding ? "space-y-3" : "space-y-2")}>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Create an account
          </h1>
          <p className="text-sm text-muted-foreground">
            Already have an account? {signInLink}
          </p>
        </div>
      ) : null}

      <GoogleOAuthButton
        nextPath={redirectTo}
        autoStart={googleAutoStart}
        handoffMode="sign-up"
        layout="full"
        marketingOptIn={marketingOptIn}
      />

      <AuthFormOrDivider />

      <form onSubmit={handleSignUp} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
          <div className="grid gap-2.5">
            <Label htmlFor="signup-first-name" className="text-sm font-semibold text-foreground">
              First name <RequiredMark />
            </Label>
            <Input
              id="signup-first-name"
              type="text"
              autoComplete="given-name"
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </div>
          <div className="grid gap-2.5">
            <Label htmlFor="signup-last-name" className="text-sm font-semibold text-foreground">
              Last name <RequiredMark />
            </Label>
            <Input
              id="signup-last-name"
              type="text"
              autoComplete="family-name"
              required
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-2.5">
          <Label htmlFor="signup-username" className="text-sm font-semibold text-foreground">
            Username{" "}
            <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="signup-username"
            type="text"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Choose a public username"
          />
        </div>

        <div className="grid gap-2.5">
          <Label htmlFor="signup-email" className="text-sm font-semibold text-foreground">
            Email <RequiredMark />
          </Label>
          <Input
            id="signup-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="grid gap-2.5">
          <Label htmlFor="signup-password" className="text-sm font-semibold text-foreground">
            Password <RequiredMark />
          </Label>
          <div className="relative">
            <Input
              id="signup-password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pr-11"
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => setShowPassword((current) => !current)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
            </button>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">{SIGN_UP_PASSWORD_HINT}</p>
        </div>

        {error ? <p className="text-sm text-neutral-700">{error}</p> : null}

        <Button
          type="submit"
          disabled={isLoading}
          className="h-12 w-full rounded-full bg-neutral-500 text-base font-semibold text-white hover:bg-neutral-600"
        >
          {isLoading ? "Creating account…" : "Sign Up"}
        </Button>

        <div className="space-y-4 pt-1">
          <label className="flex cursor-pointer items-start gap-3">
            <Checkbox
              checked={marketingOptIn}
              onCheckedChange={(checked) => setMarketingOptIn(checked === true)}
              className="mt-0.5"
            />
            <span className="text-sm leading-relaxed text-foreground">
              Get the latest news and promotions via email
            </span>
          </label>

          <div className="flex items-start gap-3">
            <Checkbox
              id="signup-accept-terms"
              checked={acceptedTerms}
              onCheckedChange={(checked) => setAcceptedTerms(checked === true)}
              className="mt-0.5"
              aria-required="true"
            />
            <div className="min-w-0 flex-1">
              <label htmlFor="signup-accept-terms" className="cursor-pointer text-sm leading-relaxed text-foreground">
                By clicking Sign Up, I expressly agree to accept Reswell&apos;s{" "}
                <Link href="/terms" className="underline underline-offset-4 hover:text-cerulean">
                  Terms of Use
                </Link>{" "}
                and{" "}
                <Link href="/privacy" className="underline underline-offset-4 hover:text-cerulean">
                  Privacy Policy
                </Link>
                .
              </label>
            </div>
            <span className="shrink-0 rounded border border-border bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              Required
            </span>
          </div>
        </div>

        {!showPageHeader ? (
          <p className="text-center text-sm text-muted-foreground">
            Already have an account? {signInLink}
          </p>
        ) : null}
      </form>
    </div>
  )

  if (variant === "page") {
    return (
      <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-lg">{inner}</div>
      </div>
    )
  }

  return inner
}
