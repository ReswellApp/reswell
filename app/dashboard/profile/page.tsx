import { Suspense } from "react"
import { DashboardProfileSettings } from "@/components/features/dashboard/dashboard-profile-settings"
import { FollowersDashboardPanels } from "@/components/features/dashboard/followers-dashboard-panels"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2 } from "lucide-react"
import { privatePageMetadata } from "@/lib/site-metadata"

export const metadata = privatePageMetadata({
  title: "Profile — Reswell",
  description: "Update your display name, bio, location, and follower settings for your Reswell account.",
  path: "/dashboard/profile",
})

function FollowersEmbedFallback() {
  return (
    <Card>
      <CardContent className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        <span className="text-sm">Loading followers…</span>
      </CardContent>
    </Card>
  )
}

export default function DashboardProfilePage() {
  return (
    <DashboardProfileSettings
      followersTabContent={
        <Suspense fallback={<FollowersEmbedFallback />}>
          <FollowersDashboardPanels variant="tab" />
        </Suspense>
      }
    />
  )
}
