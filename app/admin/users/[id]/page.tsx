'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { ArrowLeft, MoreVertical, Package, Mail, User, RotateCcw, CheckCircle2, XCircle, Wallet, RefreshCw, Loader2, Lock, Unlock } from 'lucide-react'
import { capitalizeWords } from '@/lib/listing-labels'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { useRouter } from 'next/navigation'
import { setImpersonation as storeImpersonation } from '@/lib/impersonation'
import { revalidateListingDetailAfterProfileUpdate } from '@/app/actions/listing-detail-cache'

interface Profile {
  id: string
  email: string | null
  display_name: string | null
  avatar_url: string | null
  city: string | null
  state: string | null
  bio: string | null
  is_admin: boolean
  shop_verified: boolean
  sales_count: number
  created_at: string
  updated_at: string
}

interface ListingRow {
  id: string
  title: string
  price: number
  section: string
  status: string
  hidden_from_site?: boolean | null
  created_at: string
  listing_images: { url: string }[]
}

interface WalletSummary {
  balance: number
  pendingBalance: number
  totalBalance: number
  lifetime_earned: number
  lifetime_spent: number
  lifetime_cashed_out: number
  walletId: string | null
}

interface AccountRestrictionState {
  restrictedUntil: string | null
  reason: string | null
  messageRateLimitedUntil: string | null
}

const RESTRICTION_PRESETS = [
  { label: '30 minutes', minutes: 30 },
  { label: '1 hour', minutes: 60 },
  { label: '24 hours', minutes: 60 * 24 },
  { label: '7 days', minutes: 60 * 24 * 7 },
] as const

function isFutureRestriction(iso: string | null | undefined): boolean {
  if (!iso) return false
  const ms = Date.parse(iso)
  return Number.isFinite(ms) && ms > Date.now()
}

export default function AdminUserDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const supabase = createClient()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [listings, setListings] = useState<ListingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [walletSummary, setWalletSummary] = useState<WalletSummary | null>(null)
  const [walletLoading, setWalletLoading] = useState(true)
  const [walletError, setWalletError] = useState<string | null>(null)
  const [walletResetting, setWalletResetting] = useState(false)
  const [restriction, setRestriction] = useState<AccountRestrictionState | null>(null)
  const [restrictionLoading, setRestrictionLoading] = useState(true)
  const [restrictionSaving, setRestrictionSaving] = useState(false)
  const [restrictionReason, setRestrictionReason] = useState('')
  const [selectedPresetMinutes, setSelectedPresetMinutes] = useState<number>(60 * 24)

  useEffect(() => {
    async function load() {
      const { data: p } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single()
      setProfile(p as Profile | null)

      const { data: list } = await supabase
        .from('listings')
        .select('id, title, price, section, status, created_at, listing_images(url)')
        .eq('user_id', id)
        .order('created_at', { ascending: false })
      setListings((list as ListingRow[]) || [])

      setLoading(false)
    }
    load()
  }, [id])

  useEffect(() => {
    let cancelled = false
    async function loadRestriction() {
      setRestrictionLoading(true)
      try {
        const res = await fetch(`/api/admin/users/${id}/account-restriction`, {
          credentials: 'include',
        })
        const body = (await res.json()) as {
          data?: AccountRestrictionState
          error?: string
        }
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
    loadRestriction()
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
        success?: boolean
        data?: AccountRestrictionState
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

  useEffect(() => {
    let cancelled = false
    async function loadWallet() {
      setWalletLoading(true)
      setWalletError(null)
      try {
        const res = await fetch(`/api/admin/users/${id}/wallet`)
        const body = (await res.json()) as { data?: WalletSummary; error?: string }
        if (!res.ok) {
          if (!cancelled) {
            setWalletSummary(null)
            setWalletError(body.error || 'Could not load wallet')
          }
          return
        }
        if (!cancelled && body.data) {
          setWalletSummary(body.data)
        }
      } catch {
        if (!cancelled) {
          setWalletSummary(null)
          setWalletError('Could not load wallet')
        }
      } finally {
        if (!cancelled) setWalletLoading(false)
      }
    }
    loadWallet()
    return () => {
      cancelled = true
    }
  }, [id])

  async function startImpersonation() {
    if (!profile) return
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
      router.push('/')
    } else {
      toast.error('Failed to start impersonation')
    }
  }

  async function toggleVerified() {
    if (!profile) return
    const next = !profile.shop_verified
    const { error } = await supabase
      .from('profiles')
      .update(
        next
          ? { shop_verified: true, shop_verified_at: new Date().toISOString() }
          : { shop_verified: false, shop_verified_at: null }
      )
      .eq('id', id)
    if (!error) {
      setProfile({ ...profile, shop_verified: next })
      toast.success(next ? 'Verified seller badge granted' : 'Verified seller badge removed')
      void revalidateListingDetailAfterProfileUpdate({ profileId: id })
    } else {
      toast.error('Failed to update profile')
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
      const body = (await res.json()) as {
        success?: boolean
        data?: WalletSummary
        error?: string
      }
      if (!res.ok) {
        toast.error(body.error || 'Could not reset wallet')
        return
      }
      if (body.data) {
        setWalletSummary(body.data)
      } else {
        const r = await fetch(`/api/admin/users/${id}/wallet`)
        const j = (await r.json()) as { data?: WalletSummary }
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
    const json = (await res.json().catch(() => ({}))) as {
      success?: boolean
      error?: unknown
    }
    if (res.ok) {
      setListings((prev) =>
        prev.map((l) =>
          l.id === listingId
            ? {
                ...l,
                status: newStatus,
                hidden_from_site: newStatus === 'removed' ? true : l.hidden_from_site,
              }
            : l,
        ),
      )
      toast.success(`Listing marked as ${newStatus}`)
    } else {
      const errMsg =
        typeof json.error === 'string'
          ? json.error
          : 'Failed to update listing'
      toast.error(errMsg)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/users">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <p className="text-muted-foreground">User not found.</p>
      </div>
    )
  }

  const getSectionHref = (section: string) => {
    if (section === 'surfboards') return '/boards'
    if (section === 'new') return '/l'
    return '/gear'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/users">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">User details</h1>
          <p className="text-muted-foreground">Profile and listings</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-6">
          <div className="relative h-16 w-16 rounded-full bg-muted overflow-hidden">
            {profile.avatar_url ? (
              <Image src={profile.avatar_url} alt="" fill className="object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xl font-semibold text-muted-foreground">
                {profile.display_name?.[0]?.toUpperCase() || '?'}
              </div>
            )}
          </div>
          <div className="space-y-1">
            <p className="font-medium text-foreground">
              {profile.display_name || 'No name'}
            </p>
            {profile.email && (
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Mail className="h-3 w-3" />
                {profile.email}
              </p>
            )}
            {(profile.city || profile.state) && (
              <p className="text-sm text-muted-foreground">
                {[profile.city, profile.state].filter(Boolean).join(', ')}
              </p>
            )}
            <div className="flex items-center gap-2 pt-1">
              {profile.is_admin && (
                <Badge className="bg-primary text-primary-foreground">Admin</Badge>
              )}
              {profile.shop_verified && (
                <Badge variant="outline" className={verifiedSellerBadgeClassName}>
                  <VerifiedBadge size="sm" className="-ml-0.5 mr-px" />
                  Verified Seller
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">
                Joined {format(new Date(profile.created_at), 'MMM d, yyyy')}
              </span>
            </div>
            {profile.sales_count > 0 && (
              <p className="text-xs text-muted-foreground pt-1">
                {profile.sales_count} sale{profile.sales_count !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Earnings (wallet)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {walletLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading wallet…
            </div>
          ) : walletError ? (
            <p className="text-sm text-destructive">{walletError}</p>
          ) : walletSummary ? (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-muted-foreground">Total (incl. pending)</p>
                  <p className="text-lg font-semibold tabular-nums">
                    ${walletSummary.totalBalance.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Available</p>
                  <p className="text-lg font-semibold tabular-nums">
                    ${walletSummary.balance.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Pending</p>
                  <p className="text-lg font-semibold tabular-nums">
                    ${walletSummary.pendingBalance.toFixed(2)}
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Lifetime earned ${walletSummary.lifetime_earned.toFixed(2)} · spent $
                {walletSummary.lifetime_spent.toFixed(2)} · cashed out ${walletSummary.lifetime_cashed_out.toFixed(2)}
              </p>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="gap-2"
                disabled={walletResetting}
                onClick={resetWalletEarnings}
              >
                {walletResetting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Reset earnings to $0.00
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No wallet data.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Account restriction
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {restrictionLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading restriction status…
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                {isFutureRestriction(restriction?.restrictedUntil) ? (
                  <Badge variant="destructive">Locked</Badge>
                ) : (
                  <Badge variant="outline">Active</Badge>
                )}
                {isFutureRestriction(restriction?.restrictedUntil) && restriction?.restrictedUntil ? (
                  <span className="text-sm text-muted-foreground">
                    Until {format(new Date(restriction.restrictedUntil), 'MMM d, yyyy h:mm a')}
                  </span>
                ) : restriction?.restrictedUntil ? (
                  <span className="text-sm text-muted-foreground">Lock expired</span>
                ) : null}
              </div>
              <p className="text-sm text-muted-foreground">
                Locked users can still sign in, but they cannot send messages or complete purchases.
              </p>
              {isFutureRestriction(restriction?.messageRateLimitedUntil) &&
              restriction?.messageRateLimitedUntil ? (
                <p className="text-xs text-muted-foreground">
                  Automated messaging cooldown until{' '}
                  {format(new Date(restriction.messageRateLimitedUntil), 'MMM d, yyyy h:mm a')}
                </p>
              ) : null}
              {!isFutureRestriction(restriction?.restrictedUntil) ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="restriction-duration">Lock duration</Label>
                    <div className="flex flex-wrap gap-2">
                      {RESTRICTION_PRESETS.map((preset) => (
                        <Button
                          key={preset.minutes}
                          type="button"
                          size="sm"
                          variant={
                            selectedPresetMinutes === preset.minutes ? 'default' : 'outline'
                          }
                          onClick={() => setSelectedPresetMinutes(preset.minutes)}
                        >
                          {preset.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="restriction-reason">Internal note (optional)</Label>
                    <Input
                      id="restriction-reason"
                      value={restrictionReason}
                      onChange={(event) => setRestrictionReason(event.target.value)}
                      placeholder="Reason for lock"
                      maxLength={500}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="gap-2"
                    disabled={restrictionSaving || profile.is_admin}
                    onClick={() => void applyAccountRestriction(true)}
                  >
                    {restrictionSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Lock className="h-4 w-4" />
                    )}
                    Lock account
                  </Button>
                  {profile.is_admin ? (
                    <p className="text-xs text-muted-foreground">
                      Admin accounts cannot be locked from this screen.
                    </p>
                  ) : null}
                </>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  disabled={restrictionSaving}
                  onClick={() => void applyAccountRestriction(false)}
                >
                  {restrictionSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Unlock className="h-4 w-4" />
                  )}
                  Remove lock
                </Button>
              )}
              {restriction?.reason ? (
                <p className="text-xs text-muted-foreground">Note: {restriction.reason}</p>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      {/* Verified Seller Badge */}
      <Card>
        <CardContent className="p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {profile.shop_verified ? (
              <VerifiedBadge size="lg" className="shrink-0" />
            ) : (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
            )}
            <div>
              <p className="font-medium text-[#7F9DD5] text-sm">Verified Seller Badge</p>
              <p className="text-xs text-muted-foreground">
                {profile.shop_verified
                  ? 'This user has a verified seller badge visible on their profile and listings.'
                  : 'Grant a verified badge to indicate this is a trusted seller.'}
              </p>
            </div>
          </div>
          <Button
            variant={profile.shop_verified ? 'outline' : 'default'}
            size="sm"
            onClick={toggleVerified}
            className="shrink-0"
          >
            {profile.shop_verified ? (
              <>
                <XCircle className="h-4 w-4 mr-1.5" />
                Remove
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-1.5" />
                Grant Badge
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Listings ({listings.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {listings.length === 0 ? (
            <p className="p-6 text-muted-foreground text-center">No listings</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Listing</TableHead>
                  <TableHead>Section</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {listings.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>
                      <Link
                        href={`${getSectionHref(l.section)}/${l.id}`}
                        className="font-medium text-primary hover:underline line-clamp-1 max-w-[200px]"
                      >
                        {l.title}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {l.section}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-semibold text-black dark:text-white">${l.price}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          l.status === 'active'
                            ? 'default'
                            : l.status === 'removed'
                              ? 'destructive'
                              : 'secondary'
                        }
                      >
                        {l.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(l.created_at), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`${getSectionHref(l.section)}/${l.id}`}>
                              View
                            </Link>
                          </DropdownMenuItem>
                          {l.status === 'active' && (
                            <DropdownMenuItem
                              onClick={() => updateListingStatus(l.id, 'removed')}
                            >
                              Remove
                            </DropdownMenuItem>
                          )}
                          {l.status === 'removed' && (
                            <DropdownMenuItem
                              onClick={() => updateListingStatus(l.id, 'active')}
                            >
                              Restore
                            </DropdownMenuItem>
                          )}
                          {l.status === 'sold' && (
                            <DropdownMenuItem
                              onClick={() => {
                                if (
                                  !confirm(
                                    'Make this listing live again? It was marked sold—only do this if the sale was reversed or was a mistake.'
                                  )
                                )
                                  return
                                updateListingStatus(l.id, 'active')
                              }}
                            >
                              <RotateCcw className="h-4 w-4 mr-2" /> Reactivate (make live)
                            </DropdownMenuItem>
                          )}
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
