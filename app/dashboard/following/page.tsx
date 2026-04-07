import { redirect } from "next/navigation"

/** @deprecated Merged into /dashboard/followers */
export default function DashboardFollowingRedirectPage() {
  redirect("/dashboard/followers")
}
