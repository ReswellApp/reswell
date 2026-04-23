import { DashboardProfileSettings } from "@/components/features/dashboard/dashboard-profile-settings"
import { privatePageMetadata } from "@/lib/site-metadata"

export const metadata = privatePageMetadata({
  title: "Profile — Reswell",
  description: "Update your display name, bio, location, and shipping addresses for your Reswell account.",
  path: "/dashboard/profile",
})

export default function DashboardProfilePage() {
  return <DashboardProfileSettings />
}
