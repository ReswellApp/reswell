import { redirect } from "next/navigation"

/** @deprecated Followers & following live under Profile */
export default function DashboardFollowingRedirectPage() {
  redirect("/dashboard/profile#followers")
}
