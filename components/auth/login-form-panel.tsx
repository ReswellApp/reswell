"use client"

import { useEffect, useState, type ReactNode } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { GoogleOAuthButton } from "@/components/auth/google-oauth-button"
import { HEADER_AUTH_REFRESH_EVENT } from "@/lib/auth/header-auth-refresh"
import {
  AUTH_MODAL_INNER_CARD_CLASS,
  AUTH_MODAL_INNER_CARD_CONTENT_CLASS,
  AUTH_MODAL_INNER_CARD_HEADER_CLASS,
  AUTH_MODAL_OR_EMAIL_LABEL_CLASS,
} from "@/lib/auth/auth-modal-shell-classes"
import { AuthTransitionShell } from "@/components/auth/auth-transition-shell"
import { isEmailNotConfirmedError } from "@/lib/auth/is-email-not-confirmed-error"
import { navigateAfterClientAuth } from "@/lib/auth/navigate-after-client-auth"
import { safeRedirectPath } from "@/lib/auth/safe-redirect"
import { waitForClientSession } from "@/lib/auth/wait-for-client-session"

export function LoginFormPanel({
  redirectTo,
  onLoggedIn,
  variant = "page",
  footerSignUp,
  onForgotPassword,
  googleAutoStart = false,
}: {
  redirectTo: string
  /** Called after a successful email/password login (e.g. close modal). Navigation still runs. */
  onLoggedIn?: () => void
  variant?: "page" | "modal"
  /** Override “Sign up” link (e.g. switch to sign-up in modal). */
  footerSignUp?: ReactNode
  /** When set (e.g. auth modal), “Forgot password?” stays in-flow instead of a full-page navigation. */
  onForgotPassword?: () => void
  /** Full-page login with `?google=1` after escaping an in-app browser. */
  googleAutoStart?: boolean
}) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [needsEmailConfirm, setNeedsEmailConfirm] = useState(false)
  const [resendSent, setResendSent] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [gate, setGate] = useState<"checking" | "ready" | "redirecting">("checking")
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    const dest = safeRedirectPath(redirectTo)
    void (async () => {
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
  }, [router, redirectTo])

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
      setGate("redirecting")
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

  const inner = (
    <Card className={variant === "modal" ? AUTH_MODAL_INNER_CARD_CLASS : undefined}>
      <CardHeader className={variant === "modal" ? AUTH_MODAL_INNER_CARD_HEADER_CLASS : undefined}>
        <CardTitle className="text-2xl">Welcome back</CardTitle>
        <CardDescription>Sign in to your Reswell account</CardDescription>
      </CardHeader>
      <CardContent
        className={`flex flex-col gap-6 ${variant === "modal" ? AUTH_MODAL_INNER_CARD_CONTENT_CLASS : ""}`}
      >
        <GoogleOAuthButton nextPath={redirectTo} autoStart={googleAutoStart} />
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <Separator />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span
              className={
                variant === "modal"
                  ? AUTH_MODAL_OR_EMAIL_LABEL_CLASS
                  : "bg-card px-2 text-muted-foreground"
              }
            >
              Or with email
            </span>
          </div>
        </div>
        <form onSubmit={handleLogin}>
          <div className="flex flex-col gap-6">
            <div className="grid gap-2">
              <Label htmlFor="login-email">Email</Label>
              <Input
                id="login-email"
                type="email"
                placeholder="m@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
            <div className="grid gap-3">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="login-password">Password</Label>
                {onForgotPassword ? (
                  <button
                    type="button"
                    className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
                    onClick={onForgotPassword}
                  >
                    Forgot password?
                  </button>
                ) : (
                  <Link
                    href="/auth/forgot-password"
                    className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
                  >
                    Forgot password?
                  </Link>
                )}
              </div>
              <Input
                id="login-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            {error && <p className="text-sm text-neutral-700">{error}</p>}
            {needsEmailConfirm ? (
              <div className="flex flex-col gap-2">
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
              </div>
            ) : null}
            <Button
              type="submit"
              className="h-12 w-full rounded-full bg-listingHeart text-white hover:bg-[#2a4170]"
              disabled={isLoading}
            >
              {isLoading ? "Logging in..." : "Login"}
            </Button>
          </div>
          <div className="mt-6 pb-2 text-center text-sm">
            Don&apos;t have an account?{" "}
            {footerSignUp ?? (
              <Link
                href={`/auth/sign-up?redirect=${encodeURIComponent(safeRedirectPath(redirectTo))}`}
                className="text-listingHeart underline underline-offset-4 hover:text-listingHeart/85"
              >
                Sign up
              </Link>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  )

  if (gate === "checking" || gate === "redirecting") {
    return <AuthTransitionShell />
  }

  if (variant === "page") {
    return (
      <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-sm">
          <div className="flex flex-col gap-6">{inner}</div>
        </div>
      </div>
    )
  }

  return inner
}
