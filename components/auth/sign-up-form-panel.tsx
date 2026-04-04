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
import { validateDisplayName } from "@/lib/display-name-validation"

export function SignUpFormPanel({
  variant = "page",
  footerLogin,
  onSignUpSuccess,
}: {
  variant?: "page" | "modal"
  /** Override “Login” link (e.g. switch to login in modal). */
  footerLogin?: ReactNode
  /** Called right before navigating to the confirmation page (e.g. close auth modal). */
  onSignUpSuccess?: () => void
}) {
  const [displayName, setDisplayName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [repeatPassword, setRepeatPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) router.push("/dashboard")
    })
  }, [router])

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    if (password.length < 6) {
      setError("Password must be at least 6 characters")
      setIsLoading(false)
      return
    }

    if (password !== repeatPassword) {
      setError("Passwords do not match")
      setIsLoading(false)
      return
    }

    const name = displayName?.trim()
    const nameCheck = validateDisplayName(name, email)
    if (!nameCheck.valid) {
      setError(nameCheck.error)
      setIsLoading(false)
      return
    }

    try {
      let redirectTo = window.location.origin
      const devOverride = process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL?.trim()
      if (devOverride && process.env.NODE_ENV === "development") {
        try {
          const u = new URL(devOverride.startsWith("http") ? devOverride : `https://${devOverride}`)
          if (u.hostname === "localhost" || u.hostname === "127.0.0.1") {
            redirectTo = `${u.protocol}//${u.host}`
          }
        } catch {
          /* keep window.location.origin */
        }
      }
      const { error: signError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${redirectTo}/auth/confirm`,
          data: {
            display_name: name!,
          },
        },
      })
      if (signError) throw signError
      onSignUpSuccess?.()
      router.push(`/auth/sign-up-success?email=${encodeURIComponent(email)}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  const inner = (
    <Card className={variant === "modal" ? "border-0 shadow-none" : undefined}>
      <CardHeader className={variant === "modal" ? "px-0 pt-0" : undefined}>
        <CardTitle className="text-2xl">Join Reswell</CardTitle>
        <CardDescription>Create an account to buy, sell, and trade surf gear</CardDescription>
      </CardHeader>
      <CardContent className={`flex flex-col gap-6 ${variant === "modal" ? "px-0 pb-0" : ""}`}>
        <GoogleOAuthButton nextPath="/dashboard" />
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <Separator />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">Or with email</span>
          </div>
        </div>
        <form onSubmit={handleSignUp}>
          <div className="flex flex-col gap-6">
            <div className="grid gap-2">
              <Label htmlFor="signup-display-name">
                Display Name <span className="text-destructive" aria-hidden="true">*</span>
              </Label>
              <Input
                id="signup-display-name"
                type="text"
                placeholder="e.g. SurferJoe or Alex"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                minLength={5}
                autoComplete="username"
                aria-required="true"
              />
              <p className="text-xs text-muted-foreground">
                Shown to other users instead of your email. At least 5 characters, no @.
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="signup-email">Email</Label>
              <Input
                id="signup-email"
                type="email"
                placeholder="m@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="signup-password">Password</Label>
              <Input
                id="signup-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="signup-repeat-password">Repeat Password</Label>
              <Input
                id="signup-repeat-password"
                type="password"
                required
                value={repeatPassword}
                onChange={(e) => setRepeatPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            {error && <p className="text-sm text-neutral-700">{error}</p>}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Creating an account..." : "Sign up"}
            </Button>
          </div>
          <div className="mt-4 text-center text-sm">
            Already have an account?{" "}
            {footerLogin ?? (
              <Link href="/auth/login" className="underline underline-offset-4">
                Login
              </Link>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  )

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
