import { redirect } from "next/navigation"
import Link from "next/link"
import { getCachedDashboardSession } from "@/lib/dashboard-session"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, TrendingUp, Lightbulb } from "lucide-react"

export const metadata = {
  title: "Your Followers — Dashboard",
}

export default async function FollowersPage() {
  const { supabase, user } = await getCachedDashboardSession()

  if (!user) redirect("/auth/login?redirect=/dashboard/followers")

  const [profileRes, newThisMonthRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("follower_count")
      .eq("id", user.id)
      .single(),
    supabase
      .from("seller_follows")
      .select("id", { count: "exact", head: true })
      .eq("seller_id", user.id)
      .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
  ])

  const followerCount = profileRes.data?.follower_count ?? 0
  const newThisMonth = newThisMonthRes.count ?? 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Your followers</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Buyers who follow you and get notified of your new listings
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Total followers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">
              {followerCount.toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              New this month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">
              +{newThisMonth.toLocaleString()}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tip */}
      <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20">
        <CardContent className="pt-5">
          <div className="flex gap-3">
            <Lightbulb className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-blue-900 dark:text-blue-200 text-sm">
                Keep your followers engaged
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                Post new listings regularly. Every time you list something new, all your followers get
                an in-app notification and a daily email digest — bringing them back to your shop.
              </p>
              <Link
                href="/sell"
                className="mt-2 inline-block text-sm font-medium text-blue-700 dark:text-blue-300 hover:underline"
              >
                List new gear →
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Follower list is private. Buyers can follow any seller; you can only see your total count, not who they are.
      </p>
    </div>
  )
}
