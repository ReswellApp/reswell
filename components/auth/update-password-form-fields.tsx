"use client"

import { useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { HEADER_AUTH_REFRESH_EVENT } from "@/lib/auth/header-auth-refresh"
import {
  SIGN_UP_PASSWORD_HINT,
  validateSignUpPassword,
} from "@/lib/auth/sign-up-password-validation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function UpdatePasswordFormFields({
  onSuccess,
  primaryCta = "Update password",
}: {
  onSuccess?: () => void
  primaryCta?: string
}) {
  const [password, setPassword] = useState("")
  const [repeatPassword, setRepeatPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    const passwordCheck = validateSignUpPassword(password)
    if (!passwordCheck.valid) {
      setError(passwordCheck.error)
      setIsLoading(false)
      return
    }

    if (password !== repeatPassword) {
      setError("Passwords do not match")
      setIsLoading(false)
      return
    }

    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError
      await supabase.auth.getSession()
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event(HEADER_AUTH_REFRESH_EVENT))
      }
      onSuccess?.()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not update password")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="grid gap-2">
        <Label htmlFor="new-password">New password</Label>
        <Input
          id="new-password"
          type="password"
          required
          minLength={12}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          autoFocus
        />
        <p className="text-xs leading-snug text-muted-foreground">
          {SIGN_UP_PASSWORD_HINT}
        </p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="confirm-new-password">Confirm password</Label>
        <Input
          id="confirm-new-password"
          type="password"
          required
          minLength={12}
          value={repeatPassword}
          onChange={(e) => setRepeatPassword(e.target.value)}
          autoComplete="new-password"
        />
      </div>
      {error && <p className="text-sm text-neutral-700">{error}</p>}
      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? "Saving…" : primaryCta}
      </Button>
    </form>
  )
}

export function UpdatePasswordInvalidSessionActions() {
  return (
    <div className="flex flex-col gap-3">
      <Button asChild>
        <Link href="/auth/forgot-password">Request a new reset link</Link>
      </Button>
      <Button asChild variant="outline">
        <Link href="/auth/login">Sign in</Link>
      </Button>
    </div>
  )
}
