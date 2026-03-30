'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Plus, MoreVertical, Eye, Edit, Trash2, Package, Archive, Tag } from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { capitalizeWords } from '@/lib/listing-labels'
import { listingProductCardClassName } from '@/lib/listing-card-styles'

interface Listing {
  id: string
  slug?: string | null
  title: string
  price: number
  status: string
  section: string
  views: number
  created_at: string
  archived_at?: string | null
  listing_images: { url: string; is_primary: boolean }[]
}

export default function MyListingsPage() {
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [endListingId, setEndListingId] = useState<string | null>(null)
  const [endChoice, setEndChoice] = useState<'sold' | 'removed' | null>(null)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    fetchListings()
  }, [])

  async function fetchListings() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Prefer filtering out archived so ended listings only show in Archived page.
    // If archived_at column doesn't exist (migration not run), fall back to fetching all.
    let data: Listing[] | null = null

    const res = await supabase
      .from('listings')
      .select('id, slug, title, price, status, section, views, created_at, archived_at, listing_images(url, is_primary)')
      .eq('user_id', user.id)
      .is('archived_at', null)
      .order('created_at', { ascending: false })

    if (res.error) {
      const fallback = await supabase
        .from('listings')
        .select('id, slug, title, price, status, section, views, created_at, listing_images(url, is_primary)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      if (!fallback.error && fallback.data) {
        data = fallback.data as Listing[]
      }
    } else {
      data = res.data as Listing[]
    }

    if (data) {
      setListings(data)
    }
    setLoading(false)
  }

  async function handleStatusChange(id: string, newStatus: string) {
    const { error } = await supabase
      .from('listings')
      .update({ status: newStatus })
      .eq('id', id)

    if (!error) {
      setListings(prev => prev.map(l => l.id === id ? { ...l, status: newStatus } : l))
      toast.success(`Listing marked as ${newStatus}`)
    } else {
      toast.error('Failed to update listing')
    }
  }

  async function handleEndListing() {
    if (!endListingId || !endChoice) return
    const newStatus = endChoice

    const { error } = await supabase
      .from('listings')
      .update({
        status: newStatus,
        archived_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', endListingId)

    if (!error) {
      setListings(prev => prev.filter(l => l.id !== endListingId))
      toast.success(
        newStatus === 'sold'
          ? 'Listing marked as sold and archived'
          : 'Listing removed and archived. It will be deleted after 30 days.'
      )
    } else {
      toast.error('Failed to end listing')
    }
    setEndListingId(null)
    setEndChoice(null)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100'
      case 'sold': return 'bg-neutral-200 text-neutral-900 dark:bg-neutral-700 dark:text-neutral-100'
      case 'pending': return 'bg-neutral-50 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200'
      default: return 'bg-muted text-muted-foreground'
    }
  }

  const getSectionLabel = (section: string) => {
    switch (section) {
      case 'used': return 'Used Gear'
      case 'new': return 'New Items'
      case 'surfboards': return 'Surfboards'
      default: return section
    }
  }

  const getListingHref = (section: string, id: string, slug?: string | null) => {
    const identifier = slug || id
    if (section === 'surfboards') return `/boards/${identifier}`
    if (section === 'new') return `/shop/${id}`
    return `/used/${identifier}`
  }

  const filterByStatus = (status: string) => {
    if (status === 'all') return listings
    return listings.filter(l => l.status === status)
  }

  const ListingCard = ({ listing }: { listing: Listing }) => {
    const primaryImage = listing.listing_images?.find(img => img.is_primary) || listing.listing_images?.[0]

    return (
      <Card className={listingProductCardClassName}>
        <CardContent className="p-4">
          <div className="flex gap-4">
            <Link href={getListingHref(listing.section, listing.id, listing.slug)} className="relative w-24 h-24 rounded-lg overflow-hidden bg-muted flex-shrink-0">
              {primaryImage?.url ? (
                <Image
                  src={primaryImage.url || "/placeholder.svg"}
                  alt={capitalizeWords(listing.title)}
                  fill
                  className="object-contain"
                  style={{ objectFit: "contain" }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
            </Link>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <Link href={getListingHref(listing.section, listing.id, listing.slug)} className="font-semibold text-foreground hover:text-primary truncate block">
                    {capitalizeWords(listing.title)}
                  </Link>
                  <p className="text-lg font-bold text-black dark:text-white">${listing.price}</p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link href={getListingHref(listing.section, listing.id, listing.slug)}>
                        <Eye className="h-4 w-4 mr-2" /> View
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href={`/sell?edit=${listing.id}`}>
                        <Edit className="h-4 w-4 mr-2" /> Edit
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href={`/dashboard/listings/${listing.id}/offer-settings`}>
                        <Tag className="h-4 w-4 mr-2" /> Offer settings
                      </Link>
                    </DropdownMenuItem>
                    {listing.status === 'active' && (
                      <DropdownMenuItem onClick={() => handleStatusChange(listing.id, 'sold')}>
                        Mark as Sold
                      </DropdownMenuItem>
                    )}
                    {listing.status === 'sold' && (
                      <DropdownMenuItem onClick={() => handleStatusChange(listing.id, 'active')}>
                        Relist
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => { setEndListingId(listing.id); setEndChoice(null); }}>
                      <Archive className="h-4 w-4 mr-2" /> End listing
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <Badge variant="secondary" className={getStatusColor(listing.status)}>
                  {listing.status}
                </Badge>
                <Badge variant="outline">{getSectionLabel(listing.section)}</Badge>
              </div>
              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Eye className="h-3 w-3" /> {listing.views} views
                </span>
                <span>{formatDistanceToNow(new Date(listing.created_at), { addSuffix: true })}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">My Listings</h1>
        <div className="flex gap-2">
          <Link href="/dashboard/listings/archived">
            <Button variant="outline">
              <Archive className="h-4 w-4 mr-2" /> Archived
            </Button>
          </Link>
          <Link href="/sell">
            <Button>
              <Plus className="h-4 w-4 mr-2" /> New Listing
            </Button>
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="flex gap-4">
                  <div className="w-24 h-24 bg-muted rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded w-1/2" />
                    <div className="h-5 bg-muted rounded w-1/4" />
                    <div className="h-3 bg-muted rounded w-1/3" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : listings.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No listings yet</h3>
            <p className="text-muted-foreground mb-4">
              Start selling by creating your first listing
            </p>
            <Link href="/sell">
              <Button>
                <Plus className="h-4 w-4 mr-2" /> Create Listing
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="all">
          <TabsList className="mb-4">
            <TabsTrigger value="all">All ({listings.length})</TabsTrigger>
            <TabsTrigger value="active">Active ({filterByStatus('active').length})</TabsTrigger>
            <TabsTrigger value="sold">Sold ({filterByStatus('sold').length})</TabsTrigger>
            <TabsTrigger value="pending">Pending ({filterByStatus('pending').length})</TabsTrigger>
          </TabsList>
          <TabsContent value="all" className="space-y-4">
            {listings.map(listing => <ListingCard key={listing.id} listing={listing} />)}
          </TabsContent>
          <TabsContent value="active" className="space-y-4">
            {filterByStatus('active').map(listing => <ListingCard key={listing.id} listing={listing} />)}
          </TabsContent>
          <TabsContent value="sold" className="space-y-4">
            {filterByStatus('sold').map(listing => <ListingCard key={listing.id} listing={listing} />)}
          </TabsContent>
          <TabsContent value="pending" className="space-y-4">
            {filterByStatus('pending').map(listing => <ListingCard key={listing.id} listing={listing} />)}
          </TabsContent>
        </Tabs>
      )}

      <AlertDialog
        open={!!endListingId}
        onOpenChange={(open) => { if (!open) { setEndListingId(null); setEndChoice(null); } }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End listing</AlertDialogTitle>
            <AlertDialogDescription>
              The listing will be archived for 30 days, then permanently deleted. Choose how to end it:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-2 py-2">
            <Button
              variant={endChoice === 'sold' ? 'default' : 'outline'}
              className="justify-start"
              onClick={() => setEndChoice('sold')}
            >
              Mark as sold
            </Button>
            <Button
              variant={endChoice === 'removed' ? 'default' : 'outline'}
              className="justify-start"
              onClick={() => setEndChoice('removed')}
            >
              Remove listing (not sold)
            </Button>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleEndListing}
              disabled={!endChoice}
            >
              End listing
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
