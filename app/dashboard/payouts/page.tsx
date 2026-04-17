import { redirect } from "next/navigation"
import { privatePageMetadata } from "@/lib/site-metadata"

export const metadata = privatePageMetadata({
  title: "Payout settings — Reswell",
  description: "Payout preferences now live under Earnings — you are being redirected.",
  path: "/dashboard/payouts",
})

export default function PayoutsPage() {
  redirect("/dashboard/earnings")
}
