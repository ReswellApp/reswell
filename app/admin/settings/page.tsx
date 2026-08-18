'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Activity,
  ArrowUpRight,
  ContactRound,
  Crown,
  FolderTree,
  LayoutDashboard,
  LineChart,
  Layers,
  Loader2,
  Megaphone,
  MapPin,
  MessageSquare,
  Package,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Sparkles,
  Shield,
  ShieldCheck,
  ShoppingBag,
  Tag,
  Target,
  Trash2,
  Truck,
  UserCog,
  Users,
  Wallet,
  Waves,
  Wrench,
  FileText,
  Ticket,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const SUPER_ADMIN_EMAIL = 'haydensbsb@gmail.com'

interface ProfileRole {
  id: string
  email: string | null
  display_name: string | null
  avatar_url: string | null
  is_admin: boolean
  is_employee: boolean
}

interface CapabilityItem {
  href: string
  label: string
  description: string
  icon: LucideIcon
}

interface CapabilityGroup {
  id: string
  label: string
  items: CapabilityItem[]
}

const CAPABILITY_GROUPS: CapabilityGroup[] = [
  {
    id: 'overview',
    label: 'Overview',
    items: [
      { href: '/admin/home', label: 'Home', description: 'Jump to any admin page', icon: LayoutDashboard },
      { href: '/admin/overview', label: 'Overview', description: 'Site stats & recent activity', icon: Activity },
      { href: '/admin/listings', label: 'Listings', description: 'Search, moderate, restore', icon: Package },
      { href: '/admin/seo', label: 'SEO', description: 'Page metadata & sitemaps', icon: Search },
      { href: '/admin/users', label: 'Users', description: 'Accounts, roles & access', icon: Users },
      { href: '/admin/wallets', label: 'Wallets', description: 'Balances & payouts', icon: Wallet },
    ],
  },
  {
    id: 'orders-shipping',
    label: 'Orders & shipping',
    items: [
      { href: '/admin/orders', label: 'Orders', description: 'All marketplace orders', icon: ShoppingBag },
      { href: '/admin/orders/test-purchase', label: 'Test purchase', description: 'Run a test checkout', icon: ShoppingBag },
      { href: '/admin/orders/terminal', label: 'In-person checkout', description: 'Terminal tap-to-pay or card checkout', icon: ShoppingBag },
      { href: '/admin/shipping', label: 'Shipping', description: 'Carriers & rates', icon: Truck },
    ],
  },
  {
    id: 'analytics',
    label: 'Analytics',
    items: [
      { href: '/admin/live', label: 'Live', description: 'Active users right now', icon: Activity },
      { href: '/admin/used-board-market-dashboard', label: 'Used board market', description: 'Resale market trends', icon: Waves },
      { href: '/admin/catalog-overview', label: 'Brand catalog', description: 'Explore brand catalog', icon: FolderTree },
      { href: '/admin/search-analytics', label: 'Search analytics', description: 'Query & result insights', icon: LineChart },
      { href: '/admin/search-daily-report', label: 'Search reports', description: 'Daily, monthly, and all-time search demand briefings', icon: FileText },
      { href: '/admin/ad-sales', label: 'Ad sales', description: 'Listings sold from Google & Meta ads', icon: Megaphone },
      { href: '/admin/pickup-only-boards', label: 'Pickup-only boards', description: 'Map local-pickup surfboards for geo ads', icon: MapPin },
      { href: '/admin/giveaways', label: 'Giveaways', description: 'Raffle clicks, brand picks, and listing tickets', icon: Sparkles },
      { href: '/admin/reswell-goals', label: 'Reswell goals', description: 'Track platform goals', icon: Target },
      { href: '/admin/listings/board-catalog-data', label: 'Board data', description: 'User listing board data', icon: Layers },
    ],
  },
  {
    id: 'customer-service',
    label: 'Customer service',
    items: [
      { href: '/admin/crm', label: 'CRM', description: 'Customer relationships', icon: ContactRound },
      { href: '/admin/contact-messages', label: 'Support inbox', description: 'Contact form messages', icon: MessageSquare },
      { href: '/admin/messages', label: 'Marketplace messages', description: 'Buyer/seller threads', icon: MessageSquare },
      { href: '/admin/fraud-messages', label: 'Fraud messages', description: 'Flagged conversations', icon: Shield },
      { href: '/admin/listings/brand-requests', label: 'Brand requests', description: 'Brand & model requests', icon: Tag },
    ],
  },
  {
    id: 'admin-tools',
    label: 'Admin tools',
    items: [
      { href: '/admin/reswelltickets', label: 'Reswell tickets', description: 'Admin progress and bug tracker — not customer support', icon: Ticket },
      { href: '/admin/tools', label: 'Admin tools', description: 'Search, cache & lifecycle jobs', icon: Wrench },
      { href: '/admin/site-assets', label: 'Site assets', description: 'Visual inventory of site imagery', icon: Layers },
    ],
  },
]

interface ReindexSummary {
  indexed?: number
  errors?: number
  brandsIndexed?: number
  brandErrors?: number
  sellersIndexed?: number
  sellersRemoved?: number
  sellerErrors?: number
}

function userInitials(name: string | null, email: string | null): string {
  const base = (name?.trim() || email?.trim() || '?').replace(/@.*/, '')
  const parts = base.split(/[\s._-]+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

interface StatTileProps {
  icon: LucideIcon
  accent: 'neutral' | 'emerald' | 'amber' | 'sky' | 'violet'
  label: string
  value: string
  hint?: string
}

const STAT_ACCENT: Record<StatTileProps['accent'], string> = {
  neutral: 'bg-secondary text-foreground',
  emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  sky: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  violet: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
}

function StatTile({ icon: Icon, accent, label, value, hint }: StatTileProps) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 transition-all duration-200 hover:border-foreground/15 hover:shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg', STAT_ACCENT[accent])}>
          <Icon className="h-4 w-4" aria-hidden />
        </span>
      </div>
      <p className="mt-3 text-2xl font-bold leading-none tabular-nums tracking-tight text-foreground">
        {value}
      </p>
      {hint ? <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

function RoleRow({
  profile,
  protectedRow,
  onRevoke,
}: {
  profile: ProfileRole
  protectedRow: boolean
  onRevoke: () => void
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary text-[11px] font-semibold text-foreground ring-1 ring-border">
        {userInitials(profile.display_name, profile.email)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate text-sm font-medium text-foreground">
          {profile.display_name || `User ${profile.id.slice(0, 8)}`}
          {protectedRow ? (
            <Badge variant="secondary" className="gap-1 px-1.5 py-0 text-[10px]">
              <Crown className="h-3 w-3" /> Super
            </Badge>
          ) : null}
        </p>
        <p className="truncate text-xs text-muted-foreground">{profile.email ?? '—'}</p>
      </div>
      {protectedRow ? (
        <span className="text-xs text-muted-foreground">Protected</span>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-muted-foreground hover:text-destructive"
          onClick={onRevoke}
        >
          <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Revoke
        </Button>
      )}
    </div>
  )
}

export default function AdminSettingsPage() {
  const [currentEmail, setCurrentEmail] = useState<string | null>(null)
  const [adminEmail, setAdminEmail] = useState('')
  const [employeeEmail, setEmployeeEmail] = useState('')
  const [grantingAdmin, setGrantingAdmin] = useState(false)
  const [grantingEmployee, setGrantingEmployee] = useState(false)
  const [reindexing, setReindexing] = useState(false)
  const [reindexSummary, setReindexSummary] = useState<ReindexSummary | null>(null)
  const [admins, setAdmins] = useState<ProfileRole[]>([])
  const [employees, setEmployees] = useState<ProfileRole[]>([])
  const [loadingRoles, setLoadingRoles] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    void supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentEmail(user?.email ?? null)
    })
    void loadRoles()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadRoles() {
    setLoadingRoles(true)
    const { data } = await supabase
      .from('profiles')
      .select('id, email, display_name, avatar_url, is_admin, is_employee')
      .or('is_admin.eq.true,is_employee.eq.true')
    if (data) {
      setAdmins(data.filter((p) => p.is_admin))
      setEmployees(data.filter((p) => p.is_employee && !p.is_admin))
    }
    setLoadingRoles(false)
  }

  const isSuperAdmin = currentEmail?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()

  async function grantRole(email: string, role: 'admin' | 'employee') {
    const setGranting = role === 'admin' ? setGrantingAdmin : setGrantingEmployee
    setGranting(true)
    try {
      const res = await fetch('/api/admin/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), role, grant: true }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        toast.error(data.error || 'Failed to grant role')
        return
      }
      toast.success(role === 'admin' ? 'Admin access granted' : 'Employee access granted')
      if (role === 'admin') setAdminEmail('')
      else setEmployeeEmail('')
      await loadRoles()
    } catch {
      toast.error('Failed to grant role')
    } finally {
      setGranting(false)
    }
  }

  async function revokeRole(userId: string, role: 'admin' | 'employee') {
    const profile = [...admins, ...employees].find((p) => p.id === userId)
    const email = profile?.email
    if (!email) {
      toast.error('Cannot revoke: no email')
      return
    }
    try {
      const res = await fetch('/api/admin/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role, grant: false }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        toast.error(data.error || 'Failed to revoke')
        return
      }
      toast.success(role === 'admin' ? 'Admin access removed' : 'Employee access removed')
      await loadRoles()
    } catch {
      toast.error('Failed to revoke')
    }
  }

  async function reindexSearch() {
    setReindexing(true)
    try {
      const res = await fetch('/api/search/reindex', { method: 'POST', credentials: 'include' })
      const data = (await res.json().catch(() => ({}))) as ReindexSummary & { error?: string }
      if (!res.ok) {
        toast.error(data?.error || `Reindex failed (${res.status})`)
        return
      }
      setReindexSummary(data)
      const brandsPart =
        typeof data.brandsIndexed === 'number'
          ? `, ${data.brandsIndexed} brands${data.brandErrors ? ` (${data.brandErrors} errors)` : ''}`
          : ''
      const sellersPart =
        typeof data.sellersIndexed === 'number'
          ? `, ${data.sellersIndexed} sellers${data.sellersRemoved ? ` (${data.sellersRemoved} removed)` : ''}${
              data.sellerErrors ? ` (${data.sellerErrors} errors)` : ''
            }`
          : ''
      toast.success(
        `Reindex complete: ${data.indexed} listings${data.errors ? `, ${data.errors} errors` : ''}${brandsPart}${sellersPart}`,
      )
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Reindex failed')
    } finally {
      setReindexing(false)
    }
  }

  const stats = useMemo(
    () => ({
      admins: admins.length,
      employees: employees.length,
      staff: admins.length + employees.length,
    }),
    [admins, employees],
  )

  const totalAreas = useMemo(
    () => CAPABILITY_GROUPS.reduce((sum, g) => sum + g.items.length, 0),
    [],
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="font-headline text-3xl font-bold tracking-tight text-foreground">Settings</h1>
            <Badge
              variant="secondary"
              className={cn(
                'gap-1',
                isSuperAdmin && 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
              )}
            >
              {isSuperAdmin ? <Crown className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
              {isSuperAdmin ? 'Super admin' : 'Admin'}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Manage team access, platform tools, and jump to every admin workspace.
          </p>
        </div>
        <Button type="button" variant="outline" disabled={reindexing} onClick={() => void reindexSearch()} className="shrink-0">
          <RefreshCw className={cn('mr-2 h-4 w-4', reindexing && 'animate-spin')} />
          Reindex search
        </Button>
      </div>

      {/* KPI strip */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile icon={Shield} accent="sky" label="Admins" value={loadingRoles ? '—' : String(stats.admins)} hint="Full access" />
        <StatTile icon={UserCog} accent="violet" label="Employees" value={loadingRoles ? '—' : String(stats.employees)} hint="Limited access" />
        <StatTile icon={Users} accent="emerald" label="Total staff" value={loadingRoles ? '—' : String(stats.staff)} hint="With elevated access" />
        <StatTile icon={Settings} accent="neutral" label="Admin areas" value={String(totalAreas)} hint="Workspaces available" />
      </div>

      {/* Access control (super admin only) */}
      {isSuperAdmin ? (
        <section className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Access control</h2>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Admins card */}
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              <div className="border-b border-border p-4">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400">
                    <Shield className="h-4 w-4" />
                  </span>
                  <h3 className="font-semibold text-foreground">Admins</h3>
                  <Badge variant="outline" className="ml-auto tabular-nums">{stats.admins}</Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Full access to every workspace. Can grant or revoke admin and employee roles.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Input
                    type="email"
                    placeholder="user@example.com"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && adminEmail.trim()) void grantRole(adminEmail.trim(), 'admin')
                    }}
                    className="h-9 flex-1"
                  />
                  <Button
                    onClick={() => adminEmail.trim() && void grantRole(adminEmail.trim(), 'admin')}
                    disabled={grantingAdmin || !adminEmail.trim()}
                    className="h-9"
                  >
                    {grantingAdmin ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="mr-1.5 h-4 w-4" />}
                    {grantingAdmin ? '' : 'Grant'}
                  </Button>
                </div>
              </div>
              <div className="divide-y divide-border">
                {loadingRoles ? (
                  <div className="px-4 py-6 text-center text-sm text-muted-foreground">Loading…</div>
                ) : admins.length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm text-muted-foreground">No admins yet.</div>
                ) : (
                  admins.map((p) => (
                    <RoleRow
                      key={p.id}
                      profile={p}
                      protectedRow={p.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()}
                      onRevoke={() => void revokeRole(p.id, 'admin')}
                    />
                  ))
                )}
              </div>
            </div>

            {/* Employees card */}
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              <div className="border-b border-border p-4">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400">
                    <UserCog className="h-4 w-4" />
                  </span>
                  <h3 className="font-semibold text-foreground">Employees</h3>
                  <Badge variant="outline" className="ml-auto tabular-nums">{stats.employees}</Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Limited access to Overview and Listings. Cannot manage users or settings.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Input
                    type="email"
                    placeholder="user@example.com"
                    value={employeeEmail}
                    onChange={(e) => setEmployeeEmail(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && employeeEmail.trim()) void grantRole(employeeEmail.trim(), 'employee')
                    }}
                    className="h-9 flex-1"
                  />
                  <Button
                    variant="secondary"
                    onClick={() => employeeEmail.trim() && void grantRole(employeeEmail.trim(), 'employee')}
                    disabled={grantingEmployee || !employeeEmail.trim()}
                    className="h-9"
                  >
                    {grantingEmployee ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="mr-1.5 h-4 w-4" />}
                    {grantingEmployee ? '' : 'Grant'}
                  </Button>
                </div>
              </div>
              <div className="divide-y divide-border">
                {loadingRoles ? (
                  <div className="px-4 py-6 text-center text-sm text-muted-foreground">Loading…</div>
                ) : employees.length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm text-muted-foreground">No employees yet.</div>
                ) : (
                  employees.map((p) => (
                    <RoleRow
                      key={p.id}
                      profile={p}
                      protectedRow={false}
                      onRevoke={() => void revokeRole(p.id, 'employee')}
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        </section>
      ) : (
        <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
            <Crown className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-medium text-foreground">Role management is super-admin only</p>
            <p className="text-xs text-muted-foreground">
              Granting or revoking admin and employee access is restricted to the super admin.
            </p>
          </div>
        </div>
      )}

      {/* Platform tools */}
      <section className="space-y-3">
        <h2 className="px-1 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Platform tools</h2>
        <div className="overflow-hidden rounded-2xl border border-border bg-card p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Search className="h-4 w-4" />
              </span>
              <div>
                <h3 className="font-semibold text-foreground">Search index (Elasticsearch)</h3>
                <p className="mt-0.5 max-w-xl text-xs text-muted-foreground">
                  Rebuild listing search plus the brand, seller, and Threads forum indexes used by
                  nav typeahead and /threads search. Run after deploying Elasticsearch or if results look stale.
                </p>
                {reindexSummary ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Badge variant="secondary" className="tabular-nums">{reindexSummary.indexed ?? 0} listings</Badge>
                    {typeof reindexSummary.brandsIndexed === 'number' ? (
                      <Badge variant="secondary" className="tabular-nums">{reindexSummary.brandsIndexed} brands</Badge>
                    ) : null}
                    {typeof reindexSummary.sellersIndexed === 'number' ? (
                      <Badge variant="secondary" className="tabular-nums">{reindexSummary.sellersIndexed} sellers</Badge>
                    ) : null}
                    {reindexSummary.errors ? (
                      <Badge variant="outline" className="border-rose-500/30 text-rose-600 tabular-nums dark:text-rose-400">
                        {reindexSummary.errors} errors
                      </Badge>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => void reindexSearch()}
              disabled={reindexing}
              className="shrink-0"
            >
              {reindexing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              {reindexing ? 'Reindexing…' : 'Reindex search'}
            </Button>
          </div>
        </div>
      </section>

      {/* Quick navigation */}
      <section className="space-y-4">
        <h2 className="px-1 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Admin workspaces</h2>
        {CAPABILITY_GROUPS.map((group) => (
          <div key={group.id} className="space-y-2">
            <p className="px-1 text-xs font-medium text-muted-foreground">{group.label}</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.items.map((item) => {
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-all duration-200 hover:border-foreground/15 hover:shadow-sm"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">{item.label}</span>
                      <span className="block truncate text-xs text-muted-foreground">{item.description}</span>
                    </span>
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground" />
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </section>
    </div>
  )
}
