import { redirect } from "next/navigation"
import { privatePageMetadata } from "@/lib/site-metadata"

export const metadata = privatePageMetadata({
  title: "Following — Reswell",
  description: "Following lists now live on your profile — redirecting you there.",
  path: "/dashboard/following",
})

/** @deprecated Followers & following live under Profile */
export default function DashboardFollowingRedirectPage() {
  redirect("/dashboard/profile#followers")
}
