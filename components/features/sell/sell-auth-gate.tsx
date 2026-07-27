"use client"

import type { ReactNode } from "react"
import { SignInRequiredGate } from "@/components/auth/sign-in-required-gate"

/**
 * Only mounted when the sell layout’s server session check found no user.
 * Start on the sign-in wall (not a spinner) so /sell doesn’t flash twice.
 */
export function SellAuthGate({ children }: { children: ReactNode }) {
  return (
    <SignInRequiredGate
      fallbackPath="/sell"
      title="Sign in to sell on Reswell"
      description="Create a free account or sign in to list surfboards, fins, and other gear."
      persistSessionAcrossRoutes
      initialPhase="blocked"
    >
      {children}
    </SignInRequiredGate>
  )
}
