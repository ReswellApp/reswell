'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Package, Archive, ArrowLeft } from 'lucide-react'
import { formatDistanceToNow, format, addDays } from 'date-fns'
import { capitalizeWords } from '@/lib/listing-labels'
import { listingProductCardClassName } from '@/lib/listing-card-styles'
import { listingDetailHref } from '@/lib/listing-href'

const ARCHIVE_DAYS = 30

interface ArchivedListing {
  id: string
  slug: string | null
  title: string
  price: number
  status: string
  section: string
  archived_at: string
  listing_images: { url: string; is_primary: boolean }[]
}

export default function ArchivedListingsPage() {
  const [listings, setListings] = useState<ArchivedListing[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    fetchArchived()
    // Trigger purge of listings archived >30 days ago (no-op if cron secret required)
    fetch('/api/listings/purge-archived', { method: 'GET' }).catch(() => {})
  }, [])

  async function fetchArchived() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from('listings')
      .select('id, slug, title, price, status, section, archived_at, listing_images(url, is_primary)')
      .eq('user_id', user.id)
      .not('archived_at', 'is', null)
      .order('archived_at', { ascending: false })

    if (!error && data) {
      setListings(data as ArchivedListing[])
    }
    setLoading(false)
  }

  const getSectionLabel = (section: string) => {
    switch (section) {
      case 'used':
        return 'Surfboards'
      case 'new':
        return 'Shop (new)'
      case 'surfboards':
        return 'Surfboards'
      default:
        return section
    }
  }

  const getStatusLabel = (status: string) => {
    return status === 'sold' ? 'Sold' : 'Removed'
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link
            href="/dashboard/listings"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-2"
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> My Listings
          </Link>
          <h1 className="text-2xl font-bold text-foreground">Archived listings</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Ended listings are kept for {ARCHIVE_DAYS} days, then permanently deleted.
          </p>
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
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : listings.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Archive className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No archived listings</h3>
            <p className="text-muted-foreground mb-4">
              When you end a listing (sold or removed), it will appear here for 30 days before being deleted.
            </p>
            <Link href="/dashboard/listings">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" /> Back to My Listings
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {listings.map((listing) => {
            const primaryImage = listing.listing_images?.find(img => img.is_primary) || listing.listing_images?.[0]
            const archivedAt = new Date(listing.archived_at)
            const deleteOn = addDays(archivedAt, ARCHIVE_DAYS)
            const isPastDelete = deleteOn <= new Date()

            return (
              <Card key={listing.id} className={listingProductCardClassName}>
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    <Link
                      href={listingDetailHref(listing)}
                      className="relative w-24 h-24 rounded-lg overflow-hidden bg-muted flex-shrink-0"
                    >
                      {primaryImage?.url ? (
                        <Image
                          src={primaryImage.url}
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
                      <Link
                        href={listingDetailHref(listing)}
                        className="font-semibold text-foreground hover:text-primary block truncate"
                      >
                        {capitalizeWords(listing.title)}
                      </Link>
                      <p className="text-lg font-bold text-black dark:text-white mt-0.5">${listing.price}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <Badge variant="secondary">{getStatusLabel(listing.status)}</Badge>
                        <Badge variant="outline">{getSectionLabel(listing.section)}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-2">
                        Archived {formatDistanceToNow(archivedAt, { addSuffix: true })} ·{' '}
                        {isPastDelete ? (
                          <span className="text-neutral-700 dark:text-neutral-300">Eligible for deletion</span>
                        ) : (
                          <>Deleted on {format(deleteOn, 'MMM d, yyyy')}</>
                        )}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
