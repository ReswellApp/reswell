import { redirect } from "next/navigation"

/** Team access now lives on Profile → Sign-in. */
export default function DashboardProfileTeamPage() {
  redirect("/dashboard/profile#sign-in")
}
