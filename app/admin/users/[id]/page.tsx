'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
import { ArrowLeft, MoreVertical, Package, Flag, Mail, User, RotateCcw, CheckCircle2, XCircle } from 'lucide-react'
import { capitalizeWords } from '@/lib/listing-labels'
import { toast } from 'sonner'
import { format } from 'date-fns'

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
  created_at: string
  listing_images: { url: string }[]
}

interface ReportRow {
  id: string
  reason: string
  status: string
  created_at: string
  listing: { id: string; title: string; section: string } | null
}

export default function AdminUserDetailPage() {
  const params = useParams()
  const id = params.id as string
  const supabase = createClient()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [listings, setListings] = useState<ListingRow[]>([])
  const [reportsAsReporter, setReportsAsReporter] = useState<ReportRow[]>([])
  const [reportsAsReported, setReportsAsReported] = useState<ReportRow[]>([])
  const [loading, setLoading] = useState(true)

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

      const { data: rep } = await supabase
        .from('reports')
        .select('id, reason, status, created_at, listing:listings(id, title, section)')
        .eq('reporter_id', id)
        .order('created_at', { ascending: false })
      setReportsAsReporter((rep as ReportRow[]) || [])

      const { data: reported } = await supabase
        .from('reports')
        .select('id, reason, status, created_at, listing:listings(id, title, section)')
        .eq('reported_user_id', id)
        .order('created_at', { ascending: false })
      setReportsAsReported((reported as ReportRow[]) || [])

      setLoading(false)
    }
    load()
  }, [id])

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
    } else {
      toast.error('Failed to update profile')
    }
  }

  async function updateListingStatus(listingId: string, newStatus: string) {
    const { error } = await supabase
      .from('listings')
      .update({ status: newStatus })
      .eq('id', listingId)
    if (!error) {
      setListings((prev) =>
        prev.map((l) => (l.id === listingId ? { ...l, status: newStatus } : l))
      )
      toast.success(`Listing marked as ${newStatus}`)
    } else {
      toast.error('Failed to update listing')
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
    if (section === 'new') return '/shop'
    return '/used'
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
          <p className="text-muted-foreground">Profile, listings, and reports</p>
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
                <Badge className="bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100">
                  <CheckCircle2 className="mr-1 h-3 w-3" />
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

      {/* Verified Seller Badge */}
      <Card>
        <CardContent className="p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <CheckCircle2 className={`h-5 w-5 shrink-0 ${profile.shop_verified ? 'text-neutral-900' : 'text-muted-foreground'}`} />
            <div>
              <p className="font-medium text-foreground text-sm">Verified Seller Badge</p>
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

      {(reportsAsReporter.length > 0 || reportsAsReported.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Flag className="h-5 w-5" />
              Reports
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {reportsAsReporter.length > 0 && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">
                  Reports filed by this user ({reportsAsReporter.length})
                </p>
                <ul className="space-y-1 text-sm">
                  {reportsAsReporter.map((r) => (
                    <li key={r.id} className="flex items-center gap-2">
                      <Badge variant="outline">{r.status}</Badge>
                      <span className="capitalize">{r.reason}</span>
                      {r.listing && (
                        <Link
                          href={`${getSectionHref(r.listing.section)}/${r.listing.id}`}
                          className="text-primary hover:underline"
                        >
                          {capitalizeWords(r.listing?.title)}
                        </Link>
                      )}
                      <span className="text-muted-foreground">
                        {format(new Date(r.created_at), 'MMM d, yyyy')}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {reportsAsReported.length > 0 && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">
                  Reports against this user ({reportsAsReported.length})
                </p>
                <ul className="space-y-1 text-sm">
                  {reportsAsReported.map((r) => (
                    <li key={r.id} className="flex items-center gap-2">
                      <Badge variant="outline">{r.status}</Badge>
                      <span className="capitalize">{r.reason}</span>
                      {r.listing && (
                        <Link
                          href={`${getSectionHref(r.listing.section)}/${r.listing.id}`}
                          className="text-primary hover:underline"
                        >
                          {capitalizeWords(r.listing?.title)}
                        </Link>
                      )}
                      <span className="text-muted-foreground">
                        {format(new Date(r.created_at), 'MMM d, yyyy')}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
