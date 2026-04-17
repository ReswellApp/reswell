import type { ReactNode } from "react"
import { privatePageMetadata } from "@/lib/site-metadata"

export const metadata = privatePageMetadata({
  title: "Earnings — Reswell",
  description:
    "Reswell Bucks balance, cash out history, and payout methods for surfboard sales you have completed.",
  path: "/dashboard/earnings",
})

export default function DashboardEarningsLayout({ children }: { children: ReactNode }) {
  return children
}
