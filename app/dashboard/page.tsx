import { redirect } from "next/navigation"
import { privatePageMetadata } from "@/lib/site-metadata"

export const metadata = privatePageMetadata({
  title: "Dashboard — Reswell",
  description: "Account tools now live on their own pages — you are being redirected.",
  path: "/dashboard",
})

/** The overview home is retired. Bookmarks and old links land on listings. */
export default function DashboardPage() {
  redirect("/dashboard/listings")
}
