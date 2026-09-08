'use client'

import Image from 'next/image'
import Link from 'next/link'
import { MoreVertical, Pencil, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { AdminStatusPill } from '@/components/features/admin/admin-status-pill'
import { listingDetailHref } from '@/lib/listing-href'
import {
  listingImageShouldBypassOptimization,
  proxiedListingImageSrc,
} from '@/lib/listing-media-proxy-url'
import { capitalizeWords } from '@/lib/listing-labels'
import { formatBusinessDate } from '@/lib/utils/business-timezone'
import { adminListingStatusPill, formatAdminUsd } from '@/lib/admin/admin-user-detail-display'
import type { AdminUserDetailListingRow } from '@/lib/services/adminUserDetail'
import { cn } from '@/lib/utils'

export type AdminUserListingFilter = 'all' | 'active' | 'sold' | 'draft' | 'hidden'

const FILTERS: { id: AdminUserListingFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'sold', label: 'Sold' },
  { id: 'draft', label: 'Draft' },
  { id: 'hidden', label: 'Hidden' },
]

interface AdminUserDetailListingsProps {
  listings: AdminUserDetailListingRow[]
  filter: AdminUserListingFilter
  onFilterChange: (filter: AdminUserListingFilter) => void
  onEdit: (listing: AdminUserDetailListingRow) => void
  onUpdateStatus: (listingId: string, status: string) => void
}

function listingThumb(listing: AdminUserDetailListingRow): string {
  const images = listing.listing_images ?? []
  const primary = images.find((image) => image.is_primary) ?? images[0]
  return proxiedListingImageSrc(primary?.thumbnail_url || primary?.url) || '/placeholder.svg'
}

function matchesFilter(listing: AdminUserDetailListingRow, filter: AdminUserListingFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'hidden') return listing.hidden_from_site === true || listing.status === 'removed'
  return listing.status === filter
}

export function AdminUserDetailListings({
  listings,
  filter,
  onFilterChange,
  onEdit,
  onUpdateStatus,
}: AdminUserDetailListingsProps) {
  const rows = listings.filter((listing) => matchesFilter(listing, filter))

  return (
    <section className="admin-surface overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-border/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-headline text-sm font-semibold text-foreground">Listings</h2>
          <p className="text-xs text-muted-foreground">
            {rows.length} of {listings.length}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={filter === item.id}
              onClick={() => onFilterChange(item.id)}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium',
                filter === item.id
                  ? 'bg-[hsl(var(--admin-teal))] text-white'
                  : 'bg-muted text-muted-foreground hover:text-foreground',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-muted-foreground">
          {listings.length === 0 ? 'No listings yet.' : 'No listings match this filter.'}
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Listing</TableHead>
              <TableHead className="hidden sm:table-cell">Section</TableHead>
              <TableHead>Price</TableHead>
              <TableHead className="hidden md:table-cell">Views</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden lg:table-cell">Listed</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((listing) => {
              const href = listingDetailHref({
                id: listing.id,
                slug: listing.slug,
                section: listing.section,
              })
              const status = adminListingStatusPill(listing.status)
              const thumb = listingThumb(listing)
              return (
                <TableRow key={listing.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-md bg-muted">
                        <Image
                          src={thumb}
                          alt=""
                          fill
                          className="object-cover"
                          unoptimized={listingImageShouldBypassOptimization(thumb)}
                        />
                      </div>
                      <Link href={href} className="line-clamp-2 max-w-[220px] font-medium text-foreground hover:underline">
                        {listing.title?.trim() || 'Untitled draft'}
                      </Link>
                    </div>
                  </TableCell>
                  <TableCell className="hidden capitalize text-muted-foreground sm:table-cell">
                    {capitalizeWords(listing.section.replace(/_/g, ' '))}
                  </TableCell>
                  <TableCell className="tabular-nums font-medium">{formatAdminUsd(listing.price)}</TableCell>
                  <TableCell className="hidden tabular-nums text-muted-foreground md:table-cell">
                    {listing.views.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <AdminStatusPill label={status.label} tone={status.tone} />
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                    {formatBusinessDate(listing.created_at)}
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
                          <Link href={href}>View</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onEdit(listing)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          {listing.status === 'draft' ? 'Continue draft' : 'Edit listing'}
                        </DropdownMenuItem>
                        {listing.status === 'active' ? (
                          <DropdownMenuItem onClick={() => onUpdateStatus(listing.id, 'removed')}>
                            Remove
                          </DropdownMenuItem>
                        ) : null}
                        {listing.status === 'removed' ? (
                          <DropdownMenuItem onClick={() => onUpdateStatus(listing.id, 'active')}>
                            Restore
                          </DropdownMenuItem>
                        ) : null}
                        {listing.status === 'sold' ? (
                          <DropdownMenuItem
                            onClick={() => {
                              if (
                                !confirm(
                                  'Make this listing live again? It was marked sold—only do this if the sale was reversed or was a mistake.',
                                )
                              ) {
                                return
                              }
                              onUpdateStatus(listing.id, 'active')
                            }}
                          >
                            <RotateCcw className="mr-2 h-4 w-4" />
                            Reactivate
                          </DropdownMenuItem>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
    </section>
  )
}
