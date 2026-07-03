import type { ReactNode } from "react"
import { SignInRequiredGate } from "@/components/auth/sign-in-required-gate"

export default function CartLayout({ children }: { children: ReactNode }) {
  return (
    <SignInRequiredGate
      fallbackPath="/cart"
      title="Sign in to view your cart"
      description="Create a free account or sign in to save listings and continue to checkout."
    >
      {children}
    </SignInRequiredGate>
  )
}
