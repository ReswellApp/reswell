import { Suspense } from "react"
import { Loader2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { FollowersDashboardPanels } from "@/components/features/dashboard/followers-dashboard-panels"
import { privatePageMetadata } from "@/lib/site-metadata"

export const metadata = privatePageMetadata({
  title: "Community — Reswell",
  description:
    "See who follows your shop and who you follow—one place to grow your Reswell audience.",
  path: "/dashboard/followers",
})

function FollowersPageFallback() {
  return (
    <Card>
      <CardContent className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        <span className="text-sm">Loading…</span>
      </CardContent>
    </Card>
  )
}

export default function FollowersPage() {
  return (
    <Suspense fallback={<FollowersPageFallback />}>
      <FollowersDashboardPanels />
    </Suspense>
  )
}
