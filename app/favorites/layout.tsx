import type { ReactNode } from "react"
import { SignInRequiredGate } from "@/components/auth/sign-in-required-gate"

export default function FavoritesLayout({ children }: { children: ReactNode }) {
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
