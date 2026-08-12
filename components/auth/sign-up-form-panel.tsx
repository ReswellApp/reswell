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
import { LegalDocumentDialog, type LegalDocumentId } from "@/components/features/legal/legal-document-dialog"
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
  const [legalDocument, setLegalDocument] = useState<LegalDocumentId | null>(null)
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
  const isModal = variant === "modal"
  const compact = isLanding || isModal
  const fieldGapClass = isLanding ? "gap-1" : compact ? "gap-1.5" : "gap-2.5"
  const labelClass = cn(
    "font-semibold text-foreground",
    isLanding ? "text-xs" : "text-sm",
  )

  const legalLinkClass = "underline underline-offset-4 hover:text-cerulean"

  function openLegalDocument(event: React.MouseEvent, doc: LegalDocumentId) {
    event.preventDefault()
    event.stopPropagation()
    setLegalDocument(doc)
  }

  const consentFields = (
    <div className={cn(isLanding ? "space-y-1.5" : isModal ? "space-y-2.5" : "space-y-4 pt-1")}>
      <label className={cn("flex cursor-pointer items-start", isLanding ? "gap-2" : "gap-3")}>
        <Checkbox
          checked={marketingOptIn}
          onCheckedChange={(checked) => setMarketingOptIn(checked === true)}
          className="mt-0.5"
        />
        <span
          className={cn(
            "leading-snug text-foreground",
            isLanding ? "text-xs" : "text-sm",
          )}
        >
          Get the latest news and promotions via email
        </span>
      </label>

      <div className={cn("flex items-start", isLanding ? "gap-2" : "gap-3")}>
        <Checkbox
          id="signup-accept-terms"
          checked={acceptedTerms}
          onCheckedChange={(checked) => setAcceptedTerms(checked === true)}
          className="mt-0.5"
          aria-required="true"
        />
        <div className="min-w-0 flex-1">
          <label
            htmlFor="signup-accept-terms"
            className={cn(
              "cursor-pointer leading-snug text-foreground",
              isLanding ? "text-xs" : "text-sm",
            )}
          >
            {isLanding ? (
              <>
                I agree to Reswell&apos;s{" "}
                <button
                  type="button"
                  className={legalLinkClass}
                  onClick={(event) => openLegalDocument(event, "terms")}
                >
                  Terms of Use
                </button>{" "}
                and{" "}
                <button
                  type="button"
                  className={legalLinkClass}
                  onClick={(event) => openLegalDocument(event, "privacy")}
                >
                  Privacy Policy
                </button>
                . <RequiredMark />
              </>
            ) : (
              <>
                By clicking Sign Up, I expressly agree to accept Reswell&apos;s{" "}
                <button
                  type="button"
                  className={legalLinkClass}
                  onClick={(event) => openLegalDocument(event, "terms")}
                >
                  Terms of Use
                </button>{" "}
                and{" "}
                <button
                  type="button"
                  className={legalLinkClass}
                  onClick={(event) => openLegalDocument(event, "privacy")}
                >
                  Privacy Policy
                </button>
                .
              </>
            )}
          </label>
        </div>
        <span
          className={cn(
            "shrink-0 rounded border border-border bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground",
            isLanding && "hidden",
          )}
        >
          Required
        </span>
      </div>
    </div>
  )

  const googleButton = (
    <GoogleOAuthButton
      nextPath={redirectTo}
      autoStart={googleAutoStart}
      handoffMode="sign-up"
      layout="full"
      marketingOptIn={marketingOptIn}
      className={isLanding ? "sm:w-auto sm:shrink-0" : undefined}
      buttonClassName={isLanding ? "h-10 text-sm sm:w-auto sm:px-6" : undefined}
    />
  )

  const inner = (
    <>
    <div className={cn("flex flex-col", isLanding ? "gap-2.5" : compact ? "gap-4" : "gap-8")}>
      {showPageHeader ? (
        <div
          className={cn(
            isLanding
              ? "flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
              : compact
                ? "space-y-1"
                : "space-y-2",
          )}
        >
          <div
            className={cn(
              isLanding
                ? "flex min-w-0 flex-1 items-baseline justify-between gap-3 sm:block sm:space-y-0.5"
                : compact
                  ? "space-y-1"
                  : "space-y-2",
            )}
          >
            <h1
              className={cn(
                "font-bold tracking-tight text-foreground",
                isLanding ? "text-lg sm:text-xl" : "text-3xl sm:text-4xl",
              )}
            >
              Create an account
            </h1>
            <p
              className={cn(
                "text-muted-foreground",
                isLanding ? "shrink-0 text-xs sm:mt-0.5" : "text-sm",
              )}
            >
              <span className={cn(isLanding && "hidden sm:inline")}>
                Already have an account?{" "}
              </span>
              {signInLink}
            </p>
          </div>
          {isLanding ? googleButton : null}
        </div>
      ) : null}

      {!isLanding ? googleButton : null}

      <AuthFormOrDivider className={isLanding ? "py-0" : undefined} />

      <form onSubmit={handleSignUp} className={cn(isLanding ? "space-y-2" : compact ? "space-y-3" : "space-y-5")}>
        <div
          className={cn(
            "grid grid-cols-2",
            isLanding ? "gap-2.5" : compact ? "gap-3" : "gap-4 sm:gap-5",
            !isLanding && "max-sm:grid-cols-1",
          )}
        >
          <div className={cn("grid min-w-0", fieldGapClass)}>
            <Label htmlFor="signup-first-name" className={labelClass}>
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
          <div className={cn("grid min-w-0", fieldGapClass)}>
            <Label htmlFor="signup-last-name" className={labelClass}>
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

        <div className={cn(isLanding ? "grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-2.5" : "contents")}>
          <div className={cn("grid min-w-0", fieldGapClass)}>
            <Label htmlFor="signup-username" className={labelClass}>
              Username{" "}
              <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="signup-username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={isLanding ? "Public username" : "Choose a public username"}
            />
          </div>

          <div className={cn("grid min-w-0", fieldGapClass)}>
            <Label htmlFor="signup-email" className={labelClass}>
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
        </div>

        <div className={cn("grid", fieldGapClass)}>
          <div className={cn("flex items-baseline justify-between gap-2", !isLanding && "contents")}>
            <Label htmlFor="signup-password" className={labelClass}>
              Password <RequiredMark />
            </Label>
            {isLanding ? (
              <span className="max-w-[58%] text-right text-[10px] leading-tight text-muted-foreground sm:max-w-none sm:leading-none">
                {SIGN_UP_PASSWORD_HINT}
              </span>
            ) : null}
          </div>
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
          {!isLanding ? (
            <p className="text-xs leading-snug text-muted-foreground">{SIGN_UP_PASSWORD_HINT}</p>
          ) : null}
        </div>

        {error ? <p className="text-sm text-neutral-700">{error}</p> : null}

        {isLanding ? (
          <div className="grid gap-2.5 sm:grid-cols-[1fr_auto] sm:items-start sm:gap-4">
            {consentFields}
            <Button
              type="submit"
              disabled={isLoading}
              className="h-10 w-full rounded-full bg-neutral-500 text-sm font-semibold text-white hover:bg-neutral-600 sm:min-w-[10rem] sm:px-8"
            >
              {isLoading ? "Creating account…" : "Sign Up"}
            </Button>
          </div>
        ) : (
          <>
            <Button
              type="submit"
              disabled={isLoading}
              className={cn(
                "w-full rounded-full bg-neutral-500 font-semibold text-white hover:bg-neutral-600",
                compact ? "h-10 text-sm" : "h-12 text-base",
              )}
            >
              {isLoading ? "Creating account…" : "Sign Up"}
            </Button>
            {consentFields}
          </>
        )}

        {!showPageHeader ? (
          <p className="text-center text-sm text-muted-foreground">
            Already have an account? {signInLink}
          </p>
        ) : null}
      </form>
    </div>
    <LegalDocumentDialog
      open={legalDocument !== null}
      document={legalDocument ?? "terms"}
      onOpenChange={(open) => {
        if (!open) setLegalDocument(null)
      }}
    />
    </>
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
