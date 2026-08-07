"use client"

import type { ReactNode } from "react"
import { usePathname } from "next/navigation"
import { SellAuthGate } from "@/components/features/sell/sell-auth-gate"

/**
 * Board sell (`/sell`, `/sell/boards`, `/sell/quick`) is usable while signed
 * out — the sign-in gate happens at publish. Other category sell routes keep
 * the hard sign-in gate.
 */
export function SellUnsignedAccess({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const allowUnsigned =
    pathname === "/sell" ||
    pathname === "/sell/boards" ||
    pathname.startsWith("/sell/boards/") ||
    pathname === "/sell/quick"

  if (allowUnsigned) return children
  return <SellAuthGate>{children}</SellAuthGate>
}
