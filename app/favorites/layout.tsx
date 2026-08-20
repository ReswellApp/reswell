import type { ReactNode } from "react"
import { SignInRequiredGate } from "@/components/auth/sign-in-required-gate"
import { getCachedRequestSession } from "@/lib/auth/cached-request-session"

export default async function FavoritesLayout({ children }: { children: ReactNode }) {
  const { user } = await getCachedRequestSession()
  // Server cookies are the source of truth. A missing browser Supabase session
  // (httpOnly SSR cookies) must not send a signed-in user through the sign-in wall.
  if (user) return children

  return (
    <SignInRequiredGate
      fallbackPath="/favorites"
      title="Sign in to view saved listings"
      description="Create a free account or sign in to save surfboards and gear you love."
    >
      {children}
    </SignInRequiredGate>
  )
}
