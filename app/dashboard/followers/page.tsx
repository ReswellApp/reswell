import { FollowersDashboardPanels } from "@/components/features/dashboard/followers-dashboard-panels"
import { privatePageMetadata } from "@/lib/site-metadata"

export const metadata = privatePageMetadata({
  title: "Followers — Reswell",
  description: "See who follows your shop or profile and manage follower activity on Reswell.",
  path: "/dashboard/followers",
})

export default function FollowersDashboardPage() {
  return <FollowersDashboardPanels variant="page" />
}
