'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Copy,
  ExternalLink,
  Loader2,
  MessageSquarePlus,
  MoreHorizontal,
  UserCog,
} from 'lucide-react'
import { toast } from 'sonner'
import { setImpersonation as storeImpersonation } from '@/lib/impersonation'
import { revalidateListingDetailAfterProfileUpdate } from '@/app/actions/listing-detail-cache'
import { AdminSendUserMessageDialog } from '@/components/features/admin/admin-start-user-conversation-dialog'
import { AdminPageHeader } from '@/components/features/admin/admin-page-header'
import { AdminStatStrip } from '@/components/features/admin/admin-stat-strip'
import { AdminUserDetailIdentity } from '@/components/features/admin/admin-user-detail-identity'
import { AdminUserDetailAccount } from '@/components/features/admin/admin-user-detail-account'
import { AdminUserDetailWallet } from '@/components/features/admin/admin-user-detail-wallet'
import type { AdminUserWalletSummary } from '@/components/features/admin/admin-user-detail-wallet'
import { AdminUserDetailAccess } from '@/components/features/admin/admin-user-detail-access'
import {
  AdminUserDetailRestriction,
  type AdminAccountRestrictionState,
} from '@/components/features/admin/admin-user-detail-restriction'
import {
  AdminUserDetailSellerBan,
  type AdminSellerBanState,
} from '@/components/features/admin/admin-user-detail-seller-ban'
import {
  AdminUserDetailListings,
  type AdminUserListingFilter,
} from '@/components/features/admin/admin-user-detail-listings'
import { AdminUserDetailOrders } from '@/components/features/admin/admin-user-detail-orders'
import { peerListingEditHref } from '@/lib/peer-listing-sections'
import { withAdminListingEditEntry } from '@/lib/utils/admin-listing-edit-entry'
import { sellerProfileHref } from '@/lib/seller-slug'
import { formatAdminUsd } from '@/lib/admin/admin-user-detail-display'
import type {
  AdminUserAuthFacts,
  AdminUserCommerce,
  AdminUserDetail,
  AdminUserDetailListingRow,
  AdminUserDetailProfileRow,
  AdminUserRecentOrder,
} from '@/lib/services/adminUserDetail'

export default function AdminUserDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const supabase = createClient()
  const [profile, setProfile] = useState<AdminUserDetailProfileRow | null>(null)
  const [listings, setListings] = useState<AdminUserDetailListingRow[]>([])
  const [auth, setAuth] = useState<AdminUserAuthFacts | null>(null)
  const [commerce, setCommerce] = useState<AdminUserCommerce | null>(null)
  const [recentOrders, setRecentOrders] = useState<AdminUserRecentOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [listingFilter, setListingFilter] = useState<AdminUserListingFilter>('all')
  const [walletSummary, setWalletSummary] = useState<AdminUserWalletSummary | null>(null)
  const [walletLoading, setWalletLoading] = useState(true)
  const [walletError, setWalletError] = useState<string | null>(null)
  const [walletResetting, setWalletResetting] = useState(false)
  const [restriction, setRestriction] = useState<AdminAccountRestrictionState | null>(null)
  const [restrictionLoading, setRestrictionLoading] = useState(true)
  const [restrictionSaving, setRestrictionSaving] = useState(false)
  const [restrictionReason, setRestrictionReason] = useState('')
  const [selectedPresetMinutes, setSelectedPresetMinutes] = useState<number>(60 * 24)
  const [sellerBan, setSellerBan] = useState<AdminSellerBanState | null>(null)
  const [sellerBanLoading, setSellerBanLoading] = useState(true)
  const [sellerBanSaving, setSellerBanSaving] = useState(false)
  const [sellerBanReason, setSellerBanReason] = useState('')
  const [messageDialogOpen, setMessageDialogOpen] = useState(false)

  const listingCounts = useMemo(() => {
    let active = 0
    let sold = 0
    let draft = 0
    let hidden = 0
    for (const listing of listings) {
      if (listing.status === 'active') active += 1
      if (listing.status === 'sold') sold += 1
      if (listing.status === 'draft') draft += 1
      if (listing.hidden_from_site || listing.status === 'removed') hidden += 1
    }
    return { total: listings.length, active, sold, draft, hidden }
  }, [listings])

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!id) return
      setLoading(true)
      try {
        const res = await fetch(`/api/admin/users/${id}`, { credentials: 'include' })
        const body = (await res.json()) as { data?: AdminUserDetail; error?: string }
        if (!res.ok || !body.data) {
          if (!cancelled) {
            setProfile(null)
            setListings([])
            setAuth(null)
            setCommerce(null)
            setRecentOrders([])
          }
          return
        }
        if (!cancelled) {
          setProfile(body.data.profile)
          setListings(body.data.listings ?? [])
          setAuth(body.data.auth)
          setCommerce(body.data.commerce)
          setRecentOrders(body.data.recentOrders ?? [])
        }
      } catch {
        if (!cancelled) {
          setProfile(null)
          setListings([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => {
    let cancelled = false
    async function loadRestriction() {
      setRestrictionLoading(true)
      try {
        const res = await fetch(`/api/admin/users/${id}/account-restriction`, { credentials: 'include' })
        const body = (await res.json()) as { data?: AdminAccountRestrictionState; error?: string }
        if (!res.ok) {
          if (!cancelled) {
            setRestriction(null)
            toast.error(body.error || 'Could not load account restriction')
          }
          return
        }
        if (!cancelled && body.data) {
          setRestriction(body.data)
          setRestrictionReason(body.data.reason ?? '')
        }
      } catch {
        if (!cancelled) {
          setRestriction(null)
          toast.error('Could not load account restriction')
        }
      } finally {
        if (!cancelled) setRestrictionLoading(false)
      }
    }
    void loadRestriction()
    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => {
    let cancelled = false
    async function loadSellerBan() {
      setSellerBanLoading(true)
      try {
        const res = await fetch(`/api/admin/users/${id}/seller-ban`, { credentials: 'include' })
        const body = (await res.json()) as { data?: AdminSellerBanState; error?: string }
        if (!res.ok) {
          if (!cancelled) {
            setSellerBan(null)
            toast.error(body.error || 'Could not load seller ban status')
          }
          return
        }
        if (!cancelled && body.data) {
          setSellerBan(body.data)
          setSellerBanReason(body.data.sellerBannedReason ?? '')
        }
      } catch {
        if (!cancelled) {
          setSellerBan(null)
          toast.error('Could not load seller ban status')
        }
      } finally {
        if (!cancelled) setSellerBanLoading(false)
      }
    }
    void loadSellerBan()
    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => {
    let cancelled = false
    async function loadWallet() {
      setWalletLoading(true)
      setWalletError(null)
      try {
        const res = await fetch(`/api/admin/users/${id}/wallet`)
        const body = (await res.json()) as { data?: AdminUserWalletSummary; error?: string }
        if (!res.ok) {
          if (!cancelled) {
            setWalletSummary(null)
            setWalletError(body.error || 'Could not load wallet')
          }
          return
        }
        if (!cancelled && body.data) setWalletSummary(body.data)
      } catch {
        if (!cancelled) {
          setWalletSummary(null)
          setWalletError('Could not load wallet')
        }
      } finally {
        if (!cancelled) setWalletLoading(false)
      }
    }
    void loadWallet()
    return () => {
      cancelled = true
    }
  }, [id])

  async function applyAccountRestriction(restricted: boolean) {
    setRestrictionSaving(true)
    try {
      const res = await fetch(`/api/admin/users/${id}/account-restriction`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          restricted
            ? {
                restricted: true,
                durationMinutes: selectedPresetMinutes,
                reason: restrictionReason.trim() || null,
              }
            : { restricted: false },
        ),
      })
      const body = (await res.json()) as {
        data?: AdminAccountRestrictionState
        error?: string
      }
      if (!res.ok) {
        toast.error(body.error || 'Could not update account restriction')
        return
      }
      if (body.data) {
        setRestriction({
          restrictedUntil: body.data.restrictedUntil,
          reason: body.data.reason,
          messageRateLimitedUntil: restriction?.messageRateLimitedUntil ?? null,
        })
      } else if (!restricted) {
        setRestriction((prev) =>
          prev
            ? { ...prev, restrictedUntil: null, reason: null }
            : { restrictedUntil: null, reason: null, messageRateLimitedUntil: null },
        )
      }
      toast.success(restricted ? 'Account temporarily locked' : 'Account restriction removed')
    } catch {
      toast.error('Could not update account restriction')
    } finally {
      setRestrictionSaving(false)
    }
  }

  async function applySellerBan(banned: boolean) {
    setSellerBanSaving(true)
    try {
      const res = await fetch(`/api/admin/users/${id}/seller-ban`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(banned ? { banned: true, reason: sellerBanReason.trim() || null } : { banned: false }),
      })
      const body = (await res.json()) as {
        data?: AdminSellerBanState & { affectedListingCount?: number }
        error?: string
      }
      if (!res.ok) {
        toast.error(body.error || 'Could not update seller ban')
        return
      }
      if (body.data) {
        setSellerBan({
          banned: body.data.banned,
          sellerBannedAt: body.data.sellerBannedAt,
          sellerBannedReason: body.data.sellerBannedReason,
        })
        if (!body.data.banned) setSellerBanReason('')
      }
      const affected = body.data?.affectedListingCount
      toast.success(
        banned
          ? `Seller banned${typeof affected === 'number' ? ` — ${affected} listing(s) set to delinquent` : ''}`
          : `Seller ban removed${typeof affected === 'number' ? ` — ${affected} listing(s) restored` : ''}`,
      )
      router.refresh()
    } catch {
      toast.error('Could not update seller ban')
    } finally {
      setSellerBanSaving(false)
    }
  }

  async function startImpersonation(nextPath = '/') {
    if (!profile) return false
    const res = await fetch('/api/admin/impersonate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: id,
        displayName: profile.display_name || 'User',
        email: profile.email,
      }),
    })
    if (res.ok) {
      storeImpersonation({
        userId: id,
        displayName: profile.display_name || 'User',
        email: profile.email,
      })
      toast.success(`Now acting as ${profile.display_name || 'this user'}`)
      window.location.assign(nextPath)
      return true
    }
    toast.error('Failed to start impersonation')
    return false
  }

  async function toggleVerified() {
    if (!profile) return
    const next = !profile.shop_verified
    const verifiedAt = next ? new Date().toISOString() : null
    const { error } = await supabase
      .from('profiles')
      .update(next ? { shop_verified: true, shop_verified_at: verifiedAt } : { shop_verified: false, shop_verified_at: null })
      .eq('id', id)
    if (!error) {
      setProfile({ ...profile, shop_verified: next, shop_verified_at: verifiedAt })
      toast.success(next ? 'Verified seller badge granted' : 'Verified seller badge removed')
      void revalidateListingDetailAfterProfileUpdate({ profileId: id })
    } else {
      toast.error('Failed to update profile')
    }
  }

  async function toggleReswellSeller() {
    if (!profile) return
    const next = !profile.is_reswell_seller
    try {
      const res = await fetch('/api/admin/users/reswell-seller', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: id, grant: next }),
      })
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { error?: string } | null
        toast.error(json?.error ?? 'Failed to update user')
        return
      }
      setProfile({ ...profile, is_reswell_seller: next })
      toast.success(next ? 'Reswell Seller access granted (0% marketplace fee)' : 'Reswell Seller access removed')
    } catch {
      toast.error('Failed to update user')
    }
  }

  async function toggleEmployee() {
    if (!profile) return
    const next = !profile.is_employee
    const updates = next ? { is_employee: true, is_admin: false } : { is_employee: false }
    const { error } = await supabase.from('profiles').update(updates).eq('id', id)
    if (!error) {
      setProfile({ ...profile, is_employee: next, is_admin: next ? false : profile.is_admin })
      toast.success(next ? 'Employee access granted' : 'Employee access removed')
    } else {
      toast.error('Failed to update user')
    }
  }

  async function toggleAdmin() {
    if (!profile) return
    const next = !profile.is_admin
    const updates = next ? { is_admin: true, is_employee: false } : { is_admin: false }
    const { error } = await supabase.from('profiles').update(updates).eq('id', id)
    if (!error) {
      setProfile({ ...profile, is_admin: next, is_employee: next ? false : profile.is_employee })
      toast.success(next ? 'Admin access granted' : 'Admin access removed')
    } else {
      toast.error('Failed to update user')
    }
  }

  async function resetWalletEarnings() {
    if (
      !confirm(
        'Reset this account’s wallet earnings to $0.00?\n\nThis clears available and pending balances, zeros lifetime totals, and removes wallet activity and PayPal payout history for this user. Orders and listings are not changed.',
      )
    ) {
      return
    }
    setWalletResetting(true)
    try {
      const res = await fetch(`/api/admin/users/${id}/wallet`, { method: 'POST' })
      const body = (await res.json()) as { data?: AdminUserWalletSummary; error?: string }
      if (!res.ok) {
        toast.error(body.error || 'Could not reset wallet')
        return
      }
      if (body.data) {
        setWalletSummary(body.data)
      } else {
        const r = await fetch(`/api/admin/users/${id}/wallet`)
        const j = (await r.json()) as { data?: AdminUserWalletSummary }
        if (r.ok && j.data) setWalletSummary(j.data)
      }
      toast.success('Wallet earnings reset to $0.00')
    } catch {
      toast.error('Could not reset wallet')
    } finally {
      setWalletResetting(false)
    }
  }

  async function updateListingStatus(listingId: string, newStatus: string) {
    const res = await fetch('/api/admin/listings/status', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listing_ids: [listingId], status: newStatus }),
    })
    const json = (await res.json().catch(() => ({}))) as { error?: unknown }
    if (res.ok) {
      setListings((prev) =>
        prev.map((listing) =>
          listing.id === listingId
            ? {
                ...listing,
                status: newStatus,
                hidden_from_site: newStatus === 'removed' ? true : listing.hidden_from_site,
              }
            : listing,
        ),
      )
      toast.success(`Listing marked as ${newStatus}`)
    } else {
      toast.error(typeof json.error === 'string' ? json.error : 'Failed to update listing')
    }
  }

  async function copyValue(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value)
      toast.success(`${label} copied`)
    } catch {
      toast.error(`Could not copy ${label.toLowerCase()}`)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading user…
      </div>
    )
  }

  if (!profile || !auth || !commerce) {
    return (
      <div className="space-y-4">
        <AdminPageHeader
          title="User not found"
          breadcrumbs={[
            { label: 'Home', href: '/admin/home' },
            { label: 'Users', href: '/admin/users' },
            { label: 'Profile' },
          ]}
        />
        <p className="text-sm text-muted-foreground">This user could not be loaded.</p>
        <Button variant="outline" asChild>
          <Link href="/admin/users">Back to users</Link>
        </Button>
      </div>
    )
  }

  const shopHref = profile.seller_slug ? sellerProfileHref(profile) : null
  const displayName = profile.display_name || profile.email || 'User'

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={displayName}
        description={profile.email ?? 'No email on file'}
        breadcrumbs={[
          { label: 'Home', href: '/admin/home' },
          { label: 'Users', href: '/admin/users' },
          { label: displayName },
        ]}
        actions={
          <>
            <Button type="button" className="admin-btn-primary gap-2" onClick={() => setMessageDialogOpen(true)}>
              <MessageSquarePlus className="h-4 w-4" aria-hidden />
              Message user
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" className="gap-2">
                  <MoreHorizontal className="h-4 w-4" />
                  More actions
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => void startImpersonation('/')}>
                  <UserCog className="mr-2 h-4 w-4" />
                  Act as user
                </DropdownMenuItem>
                {shopHref ? (
                  <DropdownMenuItem asChild>
                    <Link href={shopHref} target="_blank">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      View public shop
                    </Link>
                  </DropdownMenuItem>
                ) : null}
                {profile.email ? (
                  <DropdownMenuItem onClick={() => void copyValue(profile.email ?? '', 'Email')}>
                    <Copy className="mr-2 h-4 w-4" />
                    Copy email
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem onClick={() => void copyValue(profile.id, 'User ID')}>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy user ID
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      <AdminStatStrip
        items={[
          {
            label: 'Listings',
            value: String(listingCounts.total),
            footnote: `${listingCounts.draft} draft · ${listingCounts.hidden} hidden`,
            tone: 'teal',
            active: listingFilter === 'all',
            onClick: () => setListingFilter('all'),
          },
          {
            label: 'Active',
            value: String(listingCounts.active),
            footnote: `${listingCounts.sold} sold`,
            tone: 'green',
            active: listingFilter === 'active',
            onClick: () => setListingFilter('active'),
          },
          {
            label: 'Seller GMS',
            value: formatAdminUsd(commerce.sellerGms),
            footnote: `${commerce.sellerSales} sale${commerce.sellerSales === 1 ? '' : 's'} · excl. shipping`,
            tone: 'blue',
            active: listingFilter === 'sold',
            onClick: () => setListingFilter('sold'),
          },
          {
            label: 'Wallet',
            value: walletSummary ? formatAdminUsd(walletSummary.balance) : walletLoading ? '…' : '—',
            footnote: walletSummary ? `${formatAdminUsd(walletSummary.pendingBalance)} pending` : 'Available balance',
            tone: 'violet',
          },
        ]}
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <AdminUserDetailIdentity profile={profile} listingsCount={listingCounts.total} />
        <AdminUserDetailAccount
          userId={profile.id}
          joinedAt={profile.created_at}
          verifiedAt={profile.shop_verified_at}
          auth={auth}
          commerce={commerce}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <AdminUserDetailWallet
          loading={walletLoading}
          error={walletError}
          summary={walletSummary}
          resetting={walletResetting}
          onReset={resetWalletEarnings}
        />
        <AdminUserDetailAccess
          profile={profile}
          onToggleVerified={() => void toggleVerified()}
          onToggleReswellSeller={() => void toggleReswellSeller()}
          onToggleEmployee={() => void toggleEmployee()}
          onToggleAdmin={() => void toggleAdmin()}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <AdminUserDetailRestriction
          loading={restrictionLoading}
          saving={restrictionSaving}
          isAdminUser={profile.is_admin}
          restriction={restriction}
          reason={restrictionReason}
          selectedMinutes={selectedPresetMinutes}
          onReasonChange={setRestrictionReason}
          onSelectMinutes={setSelectedPresetMinutes}
          onApply={(restricted) => void applyAccountRestriction(restricted)}
        />
        <AdminUserDetailSellerBan
          loading={sellerBanLoading}
          saving={sellerBanSaving}
          isAdminUser={profile.is_admin}
          ban={sellerBan}
          reason={sellerBanReason}
          onReasonChange={setSellerBanReason}
          onApply={(banned) => void applySellerBan(banned)}
        />
      </div>

      <AdminUserDetailListings
        listings={listings}
        filter={listingFilter}
        onFilterChange={setListingFilter}
        onEdit={(listing) => {
          void startImpersonation(withAdminListingEditEntry(peerListingEditHref(listing.section, listing.id)))
        }}
        onUpdateStatus={(listingId, status) => void updateListingStatus(listingId, status)}
      />

      <AdminUserDetailOrders orders={recentOrders} />

      <AdminSendUserMessageDialog
        open={messageDialogOpen}
        onOpenChange={setMessageDialogOpen}
        defaultTargetUser={{
          id: profile.id,
          display_name: profile.display_name,
          email: profile.email,
          avatar_url: profile.avatar_url,
        }}
        trigger={null}
      />
    </div>
  )
}
