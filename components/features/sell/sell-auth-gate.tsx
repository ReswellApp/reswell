"use client"

import type { ReactNode } from "react"
import { SignInRequiredGate } from "@/components/auth/sign-in-required-gate"

export function SellAuthGate({ children }: { children: ReactNode }) {
  return (
    <SignInRequiredGate
      fallbackPath="/sell"
      title="Sign in to sell on Reswell"
      description="Create a free account or sign in to list surfboards, fins, and other gear."
      persistSessionAcrossRoutes
    >
      {children}
    </SignInRequiredGate>
  )
}
