import type { ReactNode } from "react"
import { privatePageMetadata } from "@/lib/site-metadata"

export const metadata = privatePageMetadata({
  title: "Cash out — Reswell",
  description: "Legacy cash out route — redirecting to the main Earnings page for payouts.",
  path: "/dashboard/earnings/cashout",
})

export default function DashboardCashoutLegacyLayout({ children }: { children: ReactNode }) {
  return children
}
