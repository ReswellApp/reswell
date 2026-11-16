import { redirect } from "next/navigation"
import { privatePageMetadata } from "@/lib/site-metadata"
import { SITE_CLOSED, SITE_CLOSURE_ACCOUNT_HOME } from "@/lib/site-closure"

export const metadata = privatePageMetadata({
  title: "Dashboard — Reswell",
  description: "Account tools now live on their own pages — you are being redirected.",
  path: "/dashboard",
})

/** The overview home is retired. While the marketplace is closed, land on sales. */
export default function DashboardPage() {
  redirect(SITE_CLOSED ? SITE_CLOSURE_ACCOUNT_HOME : "/dashboard/listings")
}
