"use client"

import { useEffect, useState, type ReactNode } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Eye, EyeOff } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { AuthFormOrDivider } from "@/components/auth/auth-form-or-divider"
import { GoogleOAuthButton } from "@/components/auth/google-oauth-button"
import { HEADER_AUTH_REFRESH_EVENT } from "@/lib/auth/header-auth-refresh"
import { AuthLandingLoadingIndicator, AuthTransitionShell } from "@/components/auth/auth-transition-shell"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { isEmailNotConfirmedError } from "@/lib/auth/is-email-not-confirmed-error"
import { navigateAfterClientAuth } from "@/lib/auth/navigate-after-client-auth"
import { safeRedirectPath } from "@/lib/auth/safe-redirect"
import { authLandingHref } from "@/lib/auth/auth-landing-href"
import { waitForClientSession } from "@/lib/auth/wait-for-client-session"
import { cn } from "@/lib/utils"

function RequiredMark() {
  return (
    <span className="text-destructive" aria-hidden="true">
      *
    </span>
  )
}

export function LoginFormPanel({
  redirectTo,
  onLoggedIn,
  variant = "page",
  footerSignUp,
  onForgotPassword,
  onSignUp,
  googleAutoStart = false,
  signedOut = false,
}: {
  redirectTo: string
  onLoggedIn?: () => void
  variant?: "page" | "modal" | "landing"
  footerSignUp?: ReactNode
  onForgotPassword?: () => void
  onSignUp?: () => void
  googleAutoStart?: boolean
  /** When true, do not auto-redirect an existing session — user chose to sign out. */
  signedOut?: boolean
}) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [staySignedIn, setStaySignedIn] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [needsEmailConfirm, setNeedsEmailConfirm] = useState(false)
  const [resendSent, setResendSent] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [gate, setGate] = useState<"checking" | "ready" | "redirecting">(
    variant === "modal" ? "ready" : "checking",
  )
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    const dest = safeRedirectPath(redirectTo)
    void (async () => {
      if (signedOut) {
        try {
          await supabase.auth.signOut({ scope: "local" })
        } catch {
          /* stale client storage only */
        }
        setGate("ready")
        return
      }

      let session = (await supabase.auth.getSession()).data.session
      if (!session?.user) {
        session = await waitForClientSession({ supabase, maxAttempts: 20, msBetween: 50 })
      }
      if (session?.user) {
        if (variant === "modal") {
          onLoggedIn?.()
          setGate("ready")
          return
        }
        setGate("redirecting")
        await navigateAfterClientAuth(dest, router)
        return
      }
      setGate("ready")
    })()
  }, [onLoggedIn, redirectTo, router, signedOut, variant])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)
    setError(null)
    setNeedsEmailConfirm(false)
    setResendSent(false)

    try {
      const { error: signError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (signError) throw signError
      if (variant !== "modal") {
        setGate("redirecting")
      }
      await waitForClientSession({ supabase })
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event(HEADER_AUTH_REFRESH_EVENT))
      }
      onLoggedIn?.()
      await navigateAfterClientAuth(redirectTo, router)
    } catch (err: unknown) {
      setGate("ready")
      if (isEmailNotConfirmedError(err)) {
        setNeedsEmailConfirm(true)
        setError(
          "Confirm your email before signing in. Check your inbox for the link from Reswell, or resend it below.",
        )
        return
      }
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  const handleResendConfirmation = async () => {
    const trimmedEmail = email.trim()
    if (!trimmedEmail) {
      setError("Enter your email address first.")
      return
    }

    const supabase = createClient()
    setResendLoading(true)
    setError(null)
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
      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email: trimmedEmail,
        options: {
          emailRedirectTo: `${siteOrigin}/auth/confirm?next=${encodeURIComponent(safeRedirectPath(redirectTo))}`,
        },
      })
      if (resendError) throw resendError
      setResendSent(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not resend confirmation email")
    } finally {
      setResendLoading(false)
    }
  }

  const signUpLink =
    footerSignUp ??
    (onSignUp ? (
      <button
        type="button"
        className="font-medium text-foreground underline underline-offset-4 hover:text-cerulean"
        onClick={onSignUp}
      >
        Create one today
      </button>
    ) : (
      <Link
        href={authLandingHref("/auth/sign-up", redirectTo)}
        className="font-medium text-foreground underline underline-offset-4 hover:text-cerulean"
      >
        Create one today
      </Link>
    ))

  const forgotPasswordLink = onForgotPassword ? (
    <button
      type="button"
      className="font-medium text-foreground underline underline-offset-4 hover:text-cerulean"
      onClick={onForgotPassword}
    >
      Reset it
    </button>
  ) : (
    <Link
      href="/auth/forgot-password"
      className="font-medium text-foreground underline underline-offset-4 hover:text-cerulean"
    >
      Reset it
    </Link>
  )

  const showPageHeader = variant !== "modal"
  const isLanding = variant === "landing"
  const compact = isLanding || variant === "modal"

  const inner = (
    <div className={cn("flex flex-col", compact ? "gap-4" : "gap-8")}>
      {showPageHeader || variant === "modal" ? (
        <div className={cn(compact ? "space-y-1" : "space-y-2")}>
          <h1
            className={cn(
              "font-bold tracking-tight text-foreground",
              compact ? "text-xl pr-10" : "text-3xl sm:text-4xl",
            )}
          >
            Welcome back
          </h1>
          {showPageHeader ? (
            <p className="text-sm text-muted-foreground">
              Don&apos;t have an account yet? {signUpLink}
            </p>
          ) : null}
        </div>
      ) : null}

      <GoogleOAuthButton
        nextPath={redirectTo}
        autoStart={googleAutoStart}
        layout="full"
      />

      <AuthFormOrDivider />

      <form onSubmit={handleLogin} className={cn(compact ? "space-y-3" : "space-y-5")}>
        <div className={cn("grid", compact ? "gap-1.5" : "gap-2.5")}>
          <Label
            htmlFor="login-email"
            className={cn(
              "font-semibold text-foreground",
              compact ? "text-xs" : "text-sm",
            )}
          >
            Email <RequiredMark />
          </Label>
          <Input
            id="login-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={compact ? "h-10" : undefined}
          />
        </div>

        <div className={cn("grid", compact ? "gap-1.5" : "gap-2.5")}>
          <Label
            htmlFor="login-password"
            className={cn(
              "font-semibold text-foreground",
              compact ? "text-xs" : "text-sm",
            )}
          >
            Password <RequiredMark />
          </Label>
          <div className="relative">
            <Input
              id="login-password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={cn("pr-11", compact && "h-10")}
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
        </div>

        {error ? <p className="text-sm text-neutral-700">{error}</p> : null}

        {needsEmailConfirm ? (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={resendLoading || resendSent}
            onClick={() => void handleResendConfirmation()}
          >
            {resendLoading
              ? "Sending…"
              : resendSent
                ? "Confirmation email sent"
                : "Resend confirmation email"}
          </Button>
        ) : null}

        <Button
          type="submit"
          disabled={isLoading}
          className={cn(
            "w-full rounded-full bg-neutral-500 font-semibold text-white hover:bg-neutral-600",
            compact ? "h-10 text-sm" : "h-12 text-base",
          )}
        >
          {isLoading ? "Logging in…" : "Log In"}
        </Button>

        <label className="flex cursor-pointer items-center gap-2.5">
          <Checkbox
            checked={staySignedIn}
            onCheckedChange={(checked) => setStaySignedIn(checked === true)}
          />
          <span className="text-sm text-foreground">Stay signed in</span>
        </label>

        <p className="text-center text-sm text-muted-foreground">
          Forgot your password? {forgotPasswordLink}
        </p>

        {!showPageHeader ? (
          <p className="text-center text-sm text-muted-foreground">
            Don&apos;t have an account yet? {signUpLink}
          </p>
        ) : null}
      </form>
    </div>
  )

  if (variant === "page" && (gate === "checking" || gate === "redirecting")) {
    return <AuthTransitionShell />
  }

  if (variant === "landing" && (gate === "checking" || gate === "redirecting")) {
    return (
      <AuthLandingLoadingIndicator
        ariaLabel={gate === "redirecting" ? "Signing you in" : "Loading sign in"}
      />
    )
  }

  if (variant === "page") {
    return (
      <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-lg">{inner}</div>
      </div>
    )
  }

  return inner
}
