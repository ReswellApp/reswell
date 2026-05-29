import type { ReactNode } from "react"
import { privatePageMetadata } from "@/lib/site-metadata"

export const metadata = privatePageMetadata({
  title: "Wallets — Admin — Reswell",
  description: "Reconciled Reswell Bucks balances, payouts, and lifetime totals across every account.",
  path: "/admin/wallets",
})

export default function AdminWalletsLayout({ children }: { children: ReactNode }) {
  return children
}
