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
import { newBrowserSessionLoginPath } from "@/lib/auth/browser-session"
import { HEADER_AUTH_REFRESH_EVENT } from "@/lib/auth/header-auth-refresh"

export function LoginFormPanel({
  redirectTo,
  onLoggedIn,
  variant = "page",
  footerSignUp,
}: {
  redirectTo: string
  /** Called after a successful email/password login (e.g. close modal). Navigation still runs. */
  onLoggedIn?: () => void
  variant?: "page" | "modal"
  /** Override “Sign up” link (e.g. switch to sign-up in modal). */
  footerSignUp?: ReactNode
}) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) router.push(redirectTo)
    })
  }, [router, redirectTo])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    try {
      const { error: signError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (signError) throw signError
      await supabase.auth.getSession()
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event(HEADER_AUTH_REFRESH_EVENT))
      }
      onLoggedIn?.()
      router.push(redirectTo)
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  const inner = (
    <Card className={variant === "modal" ? "border-0 shadow-none" : undefined}>
      <CardHeader className={variant === "modal" ? "px-0 pt-0" : undefined}>
        <CardTitle className="text-2xl">Welcome back</CardTitle>
        <CardDescription>Sign in to your Reswell account</CardDescription>
      </CardHeader>
      <CardContent className={`flex flex-col gap-6 ${variant === "modal" ? "px-0 pb-0" : ""}`}>
        <GoogleOAuthButton nextPath={redirectTo} />
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <Separator />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">Or with email</span>
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
            <div className="grid gap-2">
              <Label htmlFor="login-password">Password</Label>
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
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Logging in..." : "Login"}
            </Button>
          </div>
          <div className="mt-4 text-center text-sm">
            Don&apos;t have an account?{" "}
            {footerSignUp ?? (
              <Link href="/auth/sign-up" className="underline underline-offset-4">
                Sign up
              </Link>
            )}
          </div>
          {variant === "page" ? (
            <p className="text-center text-xs text-muted-foreground">
              <Link href={newBrowserSessionLoginPath()} className="underline underline-offset-4">
                Sign in with a different account (separate tab session)
              </Link>
            </p>
          ) : null}
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
