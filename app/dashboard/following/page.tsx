import { redirect } from "next/navigation"
import { privatePageMetadata } from "@/lib/site-metadata"

export const metadata = privatePageMetadata({
  title: "Following — Reswell",
  description: "Open Followers in the dashboard to see who you follow.",
  path: "/dashboard/following",
})

/** @deprecated Use /dashboard/followers#shops-you-follow */
export default function DashboardFollowingRedirectPage() {
  redirect("/dashboard/followers#shops-you-follow")
}
