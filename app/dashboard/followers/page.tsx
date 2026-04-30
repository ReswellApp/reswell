import { redirect } from "next/navigation"

/** @deprecated Prefer `/dashboard/following` (Following tab) or `?tab=followers`. */
export default function DashboardFollowersRedirectPage() {
  redirect("/dashboard/following?tab=followers")
}
