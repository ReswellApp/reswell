import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  Package, 
  Users, 
  TrendingUp,
  ShoppingBag,
  Coins,
} from 'lucide-react'
import { capitalizeWords } from '@/lib/listing-labels'

export default async function AdminDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: adminProfile } = user
    ? await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
    : { data: null as { is_admin: boolean | null } | null }

  let platformPurchaseFees: {
    totalFees: number
    confirmedCount: number
    totalSaleVolume: number
  } | null = null
  let platformFeesError: string | null = null

  if (adminProfile?.is_admin) {
    try {
      const adminDb = createServiceRoleClient()
      const { data: orderRows, error: ordersError } = await adminDb
        .from('orders')
        .select('platform_fee, amount')
        .eq('status', 'confirmed')

      if (ordersError) {
        platformFeesError = 'Could not load purchase fee totals.'
      } else {
        const rows = orderRows ?? []
        platformPurchaseFees = {
          totalFees: rows.reduce((s, r) => s + Number(r.platform_fee ?? 0), 0),
          confirmedCount: rows.length,
          totalSaleVolume: rows.reduce((s, r) => s + Number(r.amount ?? 0), 0),
        }
      }
    } catch {
      platformFeesError =
        'Add SUPABASE_SERVICE_ROLE_KEY on the server to aggregate platform fees from orders.'
    }
  }

  // Fetch stats
  const [
    { count: totalListings },
    { count: activeListings },
    { count: totalUsers },
  ] = await Promise.all([
    supabase.from('listings').select('*', { count: 'exact', head: true }),
    supabase.from('listings').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
  ])

  // Fetch recent listings
  const { data: recentListings } = await supabase
    .from('listings')
    .select('id, title, price, section, status, created_at, profiles(display_name)')
    .order('created_at', { ascending: false })
    .limit(5)

  // Fetch section breakdown
  const { count: newCount } = await supabase
    .from('listings')
    .select('*', { count: 'exact', head: true })
    .eq('section', 'new')

  const { count: boardsCount } = await supabase
    .from('listings')
    .select('*', { count: 'exact', head: true })
    .eq('section', 'surfboards')

  const stats = [
    { 
      label: 'Total Listings', 
      value: totalListings || 0, 
      icon: Package,
      description: 'All time'
    },
    { 
      label: 'Active Listings', 
      value: activeListings || 0, 
      icon: TrendingUp,
      description: 'Currently live'
    },
    { 
      label: 'Total Users', 
      value: totalUsers || 0, 
      icon: Users,
      description: 'Registered accounts'
    },
  ]

  const sectionStats = [
    { label: 'Surfboards', count: boardsCount ?? 0, color: 'bg-neutral-600' },
    { label: 'Shop (new)', count: newCount ?? 0, color: 'bg-neutral-400' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Admin Dashboard</h1>
        <p className="text-muted-foreground">Welcome back! Here&apos;s an overview of Reswell.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.label}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{stat.value}</div>
              <p className="text-xs text-muted-foreground">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {adminProfile?.is_admin && (
        <Card className="border-primary/25 bg-primary/[0.04]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Coins className="h-5 w-5 text-primary" />
              Platform Reswell Bucks (fees from purchases)
            </CardTitle>
            <p className="text-sm text-muted-foreground font-normal">
              Total marketplace fees collected on completed purchases (Reswell Bucks and card
              checkout). Same units as listing prices in the app.
            </p>
          </CardHeader>
          <CardContent>
            {platformFeesError ? (
              <p className="text-sm text-muted-foreground">{platformFeesError}</p>
            ) : platformPurchaseFees ? (
              <div className="grid gap-6 sm:grid-cols-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Platform fees
                  </p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
                    ${platformPurchaseFees.totalFees.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Completed purchases
                  </p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
                    {platformPurchaseFees.confirmedCount}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Gross sale volume
                  </p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
                    ${platformPurchaseFees.totalSaleVolume.toFixed(2)}
                  </p>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      {/* Section Breakdown */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5" />
              Listings by Section
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {sectionStats.map((section) => (
                <div key={section.label} className="flex items-center gap-4">
                  <div className={`w-3 h-3 rounded-full ${section.color}`} />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">{section.label}</span>
                      <span className="text-sm text-muted-foreground">{section.count}</span>
                    </div>
                    <div className="mt-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${section.color}`}
                        style={{ 
                          width: `${totalListings ? (section.count / (totalListings || 1)) * 100 : 0}%` 
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Listings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Recent Listings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentListings?.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No listings yet</p>
              ) : (
                recentListings?.map((listing: { 
                  id: string
                  title: string
                  price: number
                  section: string
                  status: string
                  created_at: string
                  profiles: { display_name: string } | null
                }) => (
                  <div key={listing.id} className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">{capitalizeWords(listing.title)}</p>
                      <p className="text-xs text-muted-foreground">
                        by {listing.profiles?.display_name || 'Unknown'} &middot; {listing.section}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-black dark:text-white">${listing.price}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        listing.status === 'active' 
                          ? 'bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100' 
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {listing.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
