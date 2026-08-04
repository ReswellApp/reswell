"use client"

import type { ReactNode } from "react"
import { usePathname } from "next/navigation"
import { SellAuthGate } from "@/components/features/sell/sell-auth-gate"

/**
 * Board sell (`/sell`, `/sell/boards`) is usable while signed out — guest drafts
 * persist in IndexedDB until publish / photo upload. Other category sell routes
 * keep the hard sign-in gate.
 */
export function SellUnsignedAccess({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const allowUnsigned =
    pathname === "/sell" ||
    pathname === "/sell/boards" ||
    pathname.startsWith("/sell/boards/")

  if (allowUnsigned) return children
  return <SellAuthGate>{children}</SellAuthGate>
}
