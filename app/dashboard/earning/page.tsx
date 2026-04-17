import { redirect } from "next/navigation"
import { privatePageMetadata } from "@/lib/site-metadata"

export const metadata = privatePageMetadata({
  title: "Earnings — Reswell",
  description: "Canonical earnings URL is /dashboard/earnings — redirecting you there.",
  path: "/dashboard/earning",
})

export default function EarningAliasPage() {
  redirect("/dashboard/earnings")
}
