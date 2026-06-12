"use client"

import { useState, type ReactNode } from "react"
import Link from "next/link"
import { requestPasswordResetAction } from "@/lib/actions/passwordReset"
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
    setIsLoading(true)
    setError(null)

    try {
      const result = await requestPasswordResetAction({
        email,
        siteOrigin: window.location.origin,
      })
      if ("error" in result) {
        setError(result.error)
        return
      }
      setDidRequest(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  const inner = (
    <Card className={variant === "modal" ? AUTH_MODAL_INNER_CARD_CLASS : undefined}>
      <CardHeader className={variant === "modal" ? AUTH_MODAL_INNER_CARD_HEADER_CLASS : undefined}>
        <CardTitle className="text-2xl">Reset your password</CardTitle>
        <CardDescription>
          {didRequest
            ? "If an account exists for that email, we sent a link to reset your password."
            : "Enter your email and we’ll send you a secure reset link."}
        </CardDescription>
      </CardHeader>
      <CardContent
        className={`flex flex-col gap-6 ${variant === "modal" ? AUTH_MODAL_INNER_CARD_CONTENT_CLASS : ""}`}
      >
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
