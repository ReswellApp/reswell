import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  Package, 
  Users, 
  DollarSign, 
  TrendingUp,
  ShoppingBag,
  Flag
} from 'lucide-react'

export default async function AdminDashboard() {
  const supabase = await createClient()

  // Fetch stats
  const [
    { count: totalListings },
    { count: activeListings },
    { count: totalUsers },
    { count: pendingReports },
  ] = await Promise.all([
    supabase.from('listings').select('*', { count: 'exact', head: true }),
    supabase.from('listings').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
  ])

  // Fetch recent listings
  const { data: recentListings } = await supabase
    .from('listings')
    .select('id, title, price, section, status, created_at, profiles(display_name)')
    .order('created_at', { ascending: false })
    .limit(5)

  // Fetch section breakdown
  const { data: usedCount } = await supabase
    .from('listings')
    .select('*', { count: 'exact', head: true })
    .eq('section', 'used')
  
  const { data: newCount } = await supabase
    .from('listings')
    .select('*', { count: 'exact', head: true })
    .eq('section', 'new')
  
  const { data: boardsCount } = await supabase
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
    { 
      label: 'Pending Reports', 
      value: pendingReports || 0, 
      icon: Flag,
      description: 'Needs review'
    },
  ]

  const sectionStats = [
    { label: 'Used Gear', count: usedCount?.length || 0, color: 'bg-blue-500' },
    { label: 'New Items', count: newCount?.length || 0, color: 'bg-green-500' },
    { label: 'Surfboards', count: boardsCount?.length || 0, color: 'bg-amber-500' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Admin Dashboard</h1>
        <p className="text-muted-foreground">Welcome back! Here&apos;s an overview of reswell.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
                      <p className="font-medium text-foreground truncate">{listing.title}</p>
                      <p className="text-xs text-muted-foreground">
                        by {listing.profiles?.display_name || 'Unknown'} &middot; {listing.section}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-primary">${listing.price}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        listing.status === 'active' 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
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
