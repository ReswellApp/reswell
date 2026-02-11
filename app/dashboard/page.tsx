import Link from "next/link"
import Image from "next/image"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Package,
  Heart,
  MessageSquare,
  Eye,
  TrendingUp,
  ArrowRight,
  Wallet,
} from "lucide-react"

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  // Get user's listings
  const { data: listings, count: listingCount } = await supabase
    .from("listings")
    .select("*", { count: "exact" })
    .eq("user_id", user.id)

  const activeListings = listings?.filter((l) => l.status === "active").length || 0

  // Get favorites count
  const { count: favoriteCount } = await supabase
    .from("favorites")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)

  // Get unread messages
  const { count: unreadCount } = await supabase
    .from("messages")
    .select("*", { count: "exact", head: true })
    .eq("receiver_id", user.id)
    .eq("is_read", false)

  // Get recent listings
  const { data: recentListings } = await supabase
    .from("listings")
    .select(`
      *,
      listing_images (url, is_primary)
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(4)

  // Get wallet balance
  const { data: wallet } = await supabase
    .from("wallets")
    .select("balance")
    .eq("user_id", user.id)
    .single()

  // Get profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()

  const walletBalance = wallet ? parseFloat(wallet.balance) : 0

  const stats = [
    {
      name: "reswell Bucks",
      value: `R$${walletBalance.toFixed(2)}`,
      icon: Wallet,
      href: "/dashboard/wallet",
      highlight: true,
    },
    {
      name: "Active Listings",
      value: activeListings,
      total: listingCount || 0,
      icon: Package,
      href: "/dashboard/listings",
    },
    {
      name: "Saved Items",
      value: favoriteCount || 0,
      icon: Heart,
      href: "/dashboard/favorites",
    },
    {
      name: "Unread Messages",
      value: unreadCount || 0,
      icon: MessageSquare,
      href: "/messages",
    },
  ]

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold">
          Welcome back, {profile?.display_name || user.email?.split("@")[0]}
        </h1>
        <p className="text-muted-foreground">
          Here is what is happening with your listings
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Link key={stat.name} href={stat.href}>
            <Card className={`hover:shadow-md transition-shadow ${(stat as { highlight?: boolean }).highlight ? "border-primary/20 bg-primary/5" : ""}`}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.name}</p>
                    <p className={`text-3xl font-bold ${(stat as { highlight?: boolean }).highlight ? "text-primary" : ""}`}>
                      {stat.value}
                      {stat.total !== undefined && stat.total > 0 && (
                        <span className="text-lg text-muted-foreground font-normal">
                          /{stat.total}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <stat.icon className="h-6 w-6" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Recent Listings */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Your Recent Listings</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/listings">
              View All
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {recentListings && recentListings.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {recentListings.map((listing) => {
                const primaryImage = listing.listing_images?.find((img: { is_primary: boolean }) => img.is_primary) || listing.listing_images?.[0]
                return (
                  <Link
                    key={listing.id}
                    href={`/dashboard/listings/${listing.id}/edit`}
                    className="group"
                  >
                    <div className="relative aspect-square rounded-lg overflow-hidden bg-muted mb-2">
                      {primaryImage?.url ? (
                        <Image
                          src={primaryImage.url || "/placeholder.svg"}
                          alt={listing.title}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                          No Image
                        </div>
                      )}
                      <Badge
                        className="absolute top-2 left-2"
                        variant={listing.status === "active" ? "default" : "secondary"}
                      >
                        {listing.status}
                      </Badge>
                    </div>
                    <h3 className="font-medium line-clamp-1 group-hover:text-primary transition-colors">
                      {listing.title}
                    </h3>
                    <p className="text-sm text-primary font-bold">
                      ${listing.price.toFixed(2)}
                    </p>
                  </Link>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">You have not created any listings yet</p>
              <Button asChild>
                <Link href="/sell">Create Your First Listing</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Button variant="outline" className="h-auto py-4 flex-col bg-transparent" asChild>
              <Link href="/sell">
                <Package className="h-6 w-6 mb-2" />
                Create Listing
              </Link>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col bg-transparent" asChild>
              <Link href="/messages">
                <MessageSquare className="h-6 w-6 mb-2" />
                View Messages
              </Link>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col bg-transparent" asChild>
              <Link href="/dashboard/favorites">
                <Heart className="h-6 w-6 mb-2" />
                Saved Items
              </Link>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col bg-transparent" asChild>
              <Link href="/dashboard/wallet">
                <Wallet className="h-6 w-6 mb-2" />
                reswell Bucks
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
