"use client"

import { useState, type ReactNode } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { buildPasswordRecoveryCallbackUrl } from "@/lib/auth/password-recovery-callback-url"
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
      className="text-base underline underline-offset-4"
      onClick={onBackToLogin}
    >
      Back to sign in
    </button>
  ) : (
    <Link href="/auth/login" className="underline underline-offset-4">
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

  const inner = (
    <Card className={variant === "modal" ? "border-0 shadow-none" : undefined}>
      <CardHeader className={variant === "modal" ? "px-0 pt-0" : undefined}>
        <CardTitle className="text-2xl">Reset your password</CardTitle>
        <CardDescription>
          {didRequest
            ? "Check your inbox for an email from us with a link to choose a new password."
            : "Enter your email and we’ll send you a reset link."}
        </CardDescription>
      </CardHeader>
      <CardContent className={`flex flex-col gap-6 ${variant === "modal" ? "px-0 pb-0" : ""}`}>
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
              <Label htmlFor="forgot-email">Email</Label>
              <Input
                id="forgot-email"
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
    return (
      <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-sm">{inner}</div>
      </div>
    )
  }

  return inner
}
