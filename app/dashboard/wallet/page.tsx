import { redirect } from "next/navigation"
import { privatePageMetadata } from "@/lib/site-metadata"

export const metadata = privatePageMetadata({
  title: "Wallet — Reswell",
  description: "Wallet activity now lives under Earnings — you are being redirected.",
  path: "/dashboard/wallet",
})

export default function WalletPage() {
  redirect("/dashboard/earnings")
}
