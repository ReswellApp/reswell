"use client"

import { useState, type ReactNode } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { AuthMarketingBannerShell } from "@/components/auth/auth-marketing-banner-shell"
import { buildPasswordRecoveryCallbackUrl } from "@/lib/auth/password-recovery-callback-url"
import {
  AUTH_MODAL_INNER_CARD_CLASS,
  AUTH_MODAL_INNER_CARD_CONTENT_CLASS,
  AUTH_MODAL_INNER_CARD_HEADER_CLASS,
} from "@/lib/auth/auth-modal-shell-classes"
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

export function ForgotPasswordFormPanel({
  variant = "page",
  onBackToLogin,
}: {
  variant?: "page" | "modal"
  /** In the auth modal, return to sign-in instead of linking away. */
  onBackToLogin?: () => void
}) {
  const [email, setEmail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [didRequest, setDidRequest] = useState(false)

  const loginLink: ReactNode = onBackToLogin ? (
    <button
      type="button"
      className="font-medium text-foreground underline underline-offset-4 hover:text-cerulean"
      onClick={onBackToLogin}
    >
      Back to sign in
    </button>
  ) : (
    <Link
      href="/auth/login"
      className="font-medium text-foreground underline underline-offset-4 hover:text-cerulean"
    >
      Back to sign in
    </Link>
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)
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
      const redirectTo = buildPasswordRecoveryCallbackUrl(siteOrigin)
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      })
      if (resetError) throw resetError
      setDidRequest(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  const pageContent = didRequest ? (
    <div className="flex flex-col gap-6 text-center">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Check your email
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          We sent a password reset link to your inbox. The link expires after a short time for
          security.
        </p>
      </div>
      <p className="text-sm text-muted-foreground">
        If you don&apos;t see the email, check spam or{" "}
        <button
          type="button"
          className="font-medium text-foreground underline underline-offset-4 hover:text-cerulean"
          onClick={() => {
            setDidRequest(false)
            setError(null)
          }}
        >
          try again
        </button>
        .
      </p>
      {onBackToLogin ? (
        <Button
          type="button"
          variant="outline"
          className="h-12 w-full rounded-full"
          onClick={onBackToLogin}
        >
          Back to sign in
        </Button>
      ) : (
        <Button asChild variant="outline" className="h-12 w-full rounded-full">
          <Link href="/auth/login">Back to sign in</Link>
        </Button>
      )}
      <p className="text-sm text-muted-foreground">
        If you need help, just{" "}
        <Link href="/contact" className="font-medium text-listingHeart underline underline-offset-4">
          let us know
        </Link>
        .
      </p>
    </div>
  ) : (
    <div className="flex flex-col gap-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Password Reset
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Enter your email address and we&apos;ll send you a link to reset your password.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="grid gap-2 text-left">
          <Label htmlFor="forgot-email" className="text-sm font-semibold text-foreground">
            Your Email
          </Label>
          <Input
            id="forgot-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </div>
        {error ? <p className="text-sm text-neutral-700">{error}</p> : null}
        <Button
          type="submit"
          disabled={isLoading}
          className="h-12 w-full rounded-full bg-neutral-500 text-base font-semibold text-white hover:bg-neutral-600"
        >
          {isLoading ? "Sending…" : "Send Password Reset Email"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        If you need help, just{" "}
        <Link href="/contact" className="font-medium text-listingHeart underline underline-offset-4">
          let us know
        </Link>
        .
      </p>

      <p className="text-center text-sm text-muted-foreground">{loginLink}</p>
    </div>
  )

  const modalInner = (
    <Card className={AUTH_MODAL_INNER_CARD_CLASS}>
      <CardHeader className={AUTH_MODAL_INNER_CARD_HEADER_CLASS}>
        <CardTitle className="text-2xl">Reset your password</CardTitle>
        <CardDescription>
          {didRequest
            ? "Check your inbox for an email from us with a link to choose a new password."
            : "Enter your email and we’ll send you a reset link."}
        </CardDescription>
      </CardHeader>
      <CardContent className={`flex flex-col gap-6 ${AUTH_MODAL_INNER_CARD_CONTENT_CLASS}`}>
        {didRequest ? (
          <>
            <p className="text-sm text-muted-foreground">
              The link expires after a short time for security. If you don&apos;t see the email,
              check spam or{" "}
              <button
                type="button"
                className="underline underline-offset-4"
                onClick={() => {
                  setDidRequest(false)
                  setError(null)
                }}
              >
                try again
              </button>
              .
            </p>
            {onBackToLogin ? (
              <Button type="button" variant="outline" className="w-full" onClick={onBackToLogin}>
                Back to sign in
              </Button>
            ) : (
              <Button asChild variant="outline" className="w-full">
                <Link href="/auth/login">Back to sign in</Link>
              </Button>
            )}
          </>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <div className="grid gap-2">
              <Label htmlFor="forgot-email-modal">Email</Label>
              <Input
                id="forgot-email-modal"
                type="email"
                placeholder="m@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
            {error && <p className="text-sm text-neutral-700">{error}</p>}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Sending…" : "Send reset link"}
            </Button>
            <div className="text-center text-sm">{loginLink}</div>
          </form>
        )}
      </CardContent>
    </Card>
  )

  if (variant === "page") {
    return <AuthMarketingBannerShell>{pageContent}</AuthMarketingBannerShell>
  }

  return modalInner
}
