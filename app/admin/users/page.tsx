'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SiteSearchBar, siteSearchInputClassName } from '@/components/site-search-bar'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { VerifiedBadge, verifiedSellerBadgeClassName } from '@/components/verified-badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  MoreVertical,
  Users,
  Shield,
  ShieldOff,
  UserCog,
  Store,
  CheckCircle2,
  XCircle,
  Mail,
  RefreshCw,
} from 'lucide-react'
import { toast } from 'sonner'
import { format, formatDistanceToNow } from 'date-fns'
import { useRouter } from 'next/navigation'
import { setImpersonation as storeImpersonation } from '@/lib/impersonation'

interface User {
  id: string
  email: string
  display_name: string
  avatar_url: string | null
  city: string | null
  is_admin: boolean
  is_employee: boolean
  is_reswell_seller: boolean
  shop_verified: boolean
  created_at: string
  last_active_at?: string | null
  listings_count: number
}

export default function AdminUsersPage() {
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [pushingKlaviyoUserId, setPushingKlaviyoUserId] = useState<string | null>(null)
  const [runningInactiveSync, setRunningInactiveSync] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    fetchUsers()
  }, [])

  async function fetchUsers() {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })

    let reswellSellerIds = new Set<string>()
    try {
      const res = await fetch('/api/admin/users/reswell-seller')
      if (res.ok) {
        const json = (await res.json()) as { data?: { profileIds?: string[] } }
        reswellSellerIds = new Set(json.data?.profileIds ?? [])
      }
    } catch {
      // Non-fatal: list still loads without Reswell Seller badges
    }

    if (!error && data) {
      // Get listings count for each user
      const usersWithCounts = await Promise.all(
        data.map(async (user) => {
          const { count } = await supabase
            .from('listings')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
          return {
            ...user,
            listings_count: count || 0,
            is_reswell_seller: reswellSellerIds.has(user.id),
          }
        })
      )
      setUsers(usersWithCounts as User[])
    }
    setLoading(false)
  }

  async function toggleAdmin(userId: string, currentStatus: boolean) {
    const updates = currentStatus ? { is_admin: false } : { is_admin: true, is_employee: false }
    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)

    if (!error) {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_admin: !currentStatus, is_employee: currentStatus ? u.is_employee : false } : u))
      toast.success(currentStatus ? 'Admin access removed' : 'Admin access granted')
    } else {
      toast.error('Failed to update user')
    }
  }

  async function toggleEmployee(userId: string, currentStatus: boolean) {
    const updates = currentStatus ? { is_employee: false } : { is_employee: true, is_admin: false }
    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)

    if (!error) {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_employee: !currentStatus, is_admin: currentStatus ? u.is_admin : false } : u))
      toast.success(currentStatus ? 'Employee access removed' : 'Employee access granted')
    } else {
      toast.error('Failed to update user')
    }
  }

  async function toggleReswellSeller(userId: string, currentStatus: boolean) {
    const nextStatus = !currentStatus
    try {
      const res = await fetch('/api/admin/users/reswell-seller', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, grant: nextStatus }),
      })

      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { error?: string } | null
        toast.error(json?.error ?? 'Failed to update user')
        return
      }

      setUsers(prev =>
        prev.map(u => (u.id === userId ? { ...u, is_reswell_seller: nextStatus } : u)),
      )
      toast.success(
        nextStatus ? 'Reswell Seller access granted (0% marketplace fee)' : 'Reswell Seller access removed',
      )
    } catch {
      toast.error('Failed to update user')
    }
  }

  async function toggleVerified(userId: string, currentStatus: boolean) {
    const nextVerified = !currentStatus
    const { error } = await supabase
      .from('profiles')
      .update(
        nextVerified
          ? {
              shop_verified: true,
              shop_verified_at: new Date().toISOString(),
            }
          : {
              shop_verified: false,
              shop_verified_at: null,
            }
      )
      .eq('id', userId)

    if (!error) {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, shop_verified: nextVerified } : u))
      toast.success(nextVerified ? 'Verified seller badge granted' : 'Verified seller badge removed')
    } else {
      toast.error('Failed to update user')
    }
  }

  async function runInactiveSyncForEveryone() {
    setRunningInactiveSync(true)
    try {
      const res = await fetch('/api/admin/klaviyo/inactive-milestones/run', {
        method: 'POST',
        credentials: 'include',
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(typeof payload?.error === 'string' ? payload.error : 'Inactive sync failed')
        return
      }
      const s = payload?.summaries as
        | { milestoneDays: number; eligible: number; emitted: number; failed: number }[]
        | undefined
      if (Array.isArray(s)) {
        const parts = s.map(
          (row) => `${row.milestoneDays}d: ${row.emitted}/${row.eligible} sent`,
        )
        toast.success(`Inactive Klaviyo sync complete — ${parts.join(' · ')}`)
      } else {
        toast.success('Inactive Klaviyo sync finished')
      }
    } catch {
      toast.error('Inactive sync failed')
    } finally {
      setRunningInactiveSync(false)
    }
  }

  async function pushInactiveKlaviyoToUser(
    userId: string,
    strategy: 'highest_pending' | 'all_pending',
  ) {
    setPushingKlaviyoUserId(userId)
    try {
      const res = await fetch('/api/admin/klaviyo/inactive-milestones/push', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, strategy, force: false }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(
          typeof payload?.error === 'string'
            ? payload.error
            : 'Klaviyo push failed — check KLAVIYO_API_KEY & DB migration',
        )
        return
      }
      const reason =
        typeof payload.skipped_reason === 'string' ? payload.skipped_reason : ''
      const attempted = payload.milestones_attempted as unknown
      const sentArr = payload.sent as
        | { milestone_days?: number; klaviyo_ok?: boolean }[]
        | undefined

      if (reason === 'no_last_active_at') {
        toast.message('No last active time — presence never recorded for this profile')
        return
      }
      if (reason === 'no_eligible_milestone_or_all_recorded') {
        toast.message('Not inactive long enough vs 3 / 15 / 30-day tiers, or already recorded')
        return
      }
      if (reason) {
        toast.message(reason)
      }

      if (Array.isArray(attempted) && attempted.length === 0 && !reason.includes('klaviyo_inactivity')) {
        return
      }

      const okCount = Array.isArray(sentArr)
        ? sentArr.filter((s) => s.klaviyo_ok).length
        : 0
      if (okCount > 0) {
        const names = sentArr
          ?.filter((s) => s.klaviyo_ok)
          .map((s) => `${s.milestone_days}d`)
          .join(', ')
        toast.success(`Klaviyo inactive event(s) sent (${names ?? 'ok'})`)
      } else if (Array.isArray(sentArr) && sentArr.length > 0) {
        toast.error('Klaviyo rejected the event — check server logs / API key')
      }
    } catch {
      toast.error('Klaviyo push failed')
    } finally {
      setPushingKlaviyoUserId(null)
    }
  }

  async function actAsUser(user: User) {
    const res = await fetch('/api/admin/impersonate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.id,
        displayName: user.display_name || 'User',
        email: user.email,
      }),
    })
    if (res.ok) {
      storeImpersonation({
        userId: user.id,
        displayName: user.display_name || 'User',
        email: user.email,
      })
      toast.success(`Now acting as ${user.display_name || 'this user'}`)
      router.push('/')
    } else {
      toast.error('Failed to start impersonation')
    }
  }

  const filteredUsers = users.filter(user =>
    user.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Users</h1>
        <p className="text-muted-foreground">Manage user accounts and permissions</p>
      </div>

      {/* Search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <SiteSearchBar
          className="max-w-md"
          onSubmit={(e) => {
            e.preventDefault()
          }}
        >
          <Input
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={siteSearchInputClassName()}
          />
        </SiteSearchBar>
        <Button
          type="button"
          variant="outline"
          disabled={runningInactiveSync}
          onClick={() => void runInactiveSyncForEveryone()}
          className="shrink-0"
        >
          {runningInactiveSync ? (
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Run inactive Klaviyo sync
        </Button>
      </div>
      <p className="text-xs text-muted-foreground -mt-2">
        Uses the same rules as the nightly cron (last active &gt; 3 / 15 / 30 days). Per-user actions
        use the table below.
      </p>

      {/* Users Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center">
              <Users className="h-8 w-8 animate-pulse text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">Loading users...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-8 text-center">
              <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">No users found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Listings</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Last active</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <Link
                        href={`/admin/users/${user.id}`}
                        className="flex items-center gap-3 hover:opacity-90"
                      >
                        <div className="relative w-8 h-8 rounded-full bg-muted overflow-hidden flex-shrink-0">
                          {user.avatar_url ? (
                            <Image
                              src={user.avatar_url || "/placeholder.svg"}
                              alt=""
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-foreground font-semibold text-sm">
                              {user.display_name?.[0]?.toUpperCase() || '?'}
                            </div>
                          )}
                        </div>
                        <span className="font-medium text-foreground hover:text-primary">
                          {user.display_name || 'Unknown'}
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{user.email}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {user.city || '-'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{user.listings_count}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1">
                        {user.is_admin ? (
                          <Badge className="bg-primary text-primary-foreground">Admin</Badge>
                        ) : user.is_employee ? (
                          <Badge variant="secondary">Employee</Badge>
                        ) : (
                          <Badge variant="outline">User</Badge>
                        )}
                        {user.is_reswell_seller && (
                          <Badge variant="secondary">Reswell Seller</Badge>
                        )}
                        {user.shop_verified && (
                          <Badge variant="outline" className={verifiedSellerBadgeClassName}>
                            <VerifiedBadge size="sm" className="-ml-0.5 mr-px" />
                            Verified
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(user.created_at), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {user.last_active_at ? (
                        <span
                          title={format(new Date(user.last_active_at), 'PPpp')}
                          className="cursor-default"
                        >
                          {formatDistanceToNow(new Date(user.last_active_at), { addSuffix: true })}
                        </span>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => toggleAdmin(user.id, user.is_admin)}>
                            {user.is_admin ? (
                              <>
                                <ShieldOff className="h-4 w-4 mr-2" /> Remove Admin
                              </>
                            ) : (
                              <>
                                <Shield className="h-4 w-4 mr-2" /> Make Admin
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toggleEmployee(user.id, user.is_employee)}>
                            {user.is_employee ? (
                              <>
                                <UserCog className="h-4 w-4 mr-2" /> Remove Employee
                              </>
                            ) : (
                              <>
                                <UserCog className="h-4 w-4 mr-2" /> Make Employee
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => toggleReswellSeller(user.id, user.is_reswell_seller)}
                          >
                            {user.is_reswell_seller ? (
                              <>
                                <Store className="h-4 w-4 mr-2" /> Remove Reswell Seller
                              </>
                            ) : (
                              <>
                                <Store className="h-4 w-4 mr-2" /> Make Reswell Seller
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toggleVerified(user.id, user.shop_verified)}>
                            {user.shop_verified ? (
                              <>
                                <XCircle className="h-4 w-4 mr-2" /> Remove Verified Badge
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="h-4 w-4 mr-2" /> Grant Verified Badge
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={pushingKlaviyoUserId === user.id}
                            onClick={() => void pushInactiveKlaviyoToUser(user.id, 'highest_pending')}
                          >
                            <Mail className="h-4 w-4 mr-2" />
                            Klaviyo: push inactive milestone
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={pushingKlaviyoUserId === user.id}
                            onClick={() => {
                              if (
                                typeof window !== 'undefined' &&
                                !window.confirm(
                                  'Send every inactive tier they qualify for that is not recorded yet (can be multiple emails)?',
                                )
                              ) {
                                return
                              }
                              void pushInactiveKlaviyoToUser(user.id, 'all_pending')
                            }}
                          >
                            <Mail className="h-4 w-4 mr-2" />
                            Klaviyo: push all pending tiers
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
