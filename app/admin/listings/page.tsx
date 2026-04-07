'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { listingDetailHref } from '@/lib/listing-href'
import { setImpersonation } from '@/lib/impersonation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { Search, MoreVertical, Eye, Trash2, Flag, Package, RotateCcw, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { capitalizeWords } from '@/lib/listing-labels'

interface Listing {
  id: string
  user_id: string
  slug?: string | null
  title: string
  price: number
  status: string
  section: string
  views: number
  created_at: string
  profiles: { display_name: string; email: string }
  listing_images: { url: string }[]
}

export default function AdminListingsPage() {
  const router = useRouter()
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sectionFilter, setSectionFilter] = useState('all')
  const supabase = createClient()

  useEffect(() => {
    fetchListings()
  }, [statusFilter, sectionFilter])

  async function fetchListings() {
    let query = supabase
      .from('listings')
      .select(`
        id, user_id, slug, title, price, status, section, views, created_at,
        profiles(display_name, email),
        listing_images(url)
      `)
      .order('created_at', { ascending: false })

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter)
    }
    if (sectionFilter !== 'all') {
      query = query.eq('section', sectionFilter)
    }

    const { data, error } = await query

    if (!error && data) {
      setListings(data as unknown as Listing[])
    }
    setLoading(false)
  }

  async function updateListingStatus(id: string, newStatus: string) {
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

  async function deleteListing(id: string) {
    if (!confirm('Permanently delete this listing? This cannot be undone.')) return
    const res = await fetch(`/api/admin/listings?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    if (res.ok) {
      setListings(prev => prev.filter(l => l.id !== id))
      toast.success('Listing deleted')
    } else {
      const data = await res.json().catch(() => ({ error: 'Failed to delete listing' }))
      toast.error(data.error || 'Failed to delete listing')
    }
  }

  async function editListing(listing: Listing) {
    const displayName = listing.profiles?.display_name || 'User'
    const email = listing.profiles?.email || null
    const res = await fetch('/api/admin/impersonate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: listing.user_id, displayName, email }),
    })
    if (res.ok) {
      setImpersonation({ userId: listing.user_id, displayName, email })
      router.push(`/sell?edit=${listing.id}`)
    } else {
      toast.error('Failed to start impersonation for editing')
    }
  }

  const filteredListings = listings.filter(listing =>
    listing.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    listing.profiles?.display_name?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100'
      case 'sold': return 'bg-neutral-200 text-neutral-900 dark:bg-neutral-700 dark:text-neutral-100'
      case 'pending': return 'bg-neutral-50 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200'
      case 'removed': return 'bg-neutral-800 text-neutral-100 dark:bg-neutral-950 dark:text-neutral-100'
      default: return 'bg-muted text-muted-foreground'
    }
  }

  function getListingViewHref(section: string, id: string, slug?: string | null) {
    return listingDetailHref({ id, slug, section })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Manage Listings</h1>
          <p className="text-muted-foreground">View and moderate all marketplace listings</p>
        </div>
        <Button asChild>
          <Link href="/admin/listings/add">
            <Package className="h-4 w-4 mr-2" />
            Add listing (for user)
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by title or seller..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="sold">Sold</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="removed">Removed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sectionFilter} onValueChange={setSectionFilter}>
              <SelectTrigger className="w-full md:w-40">
                <SelectValue placeholder="Section" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sections</SelectItem>
                <SelectItem value="new">Shop (new)</SelectItem>
                <SelectItem value="surfboards">Surfboards</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Listings Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center">
              <Package className="h-8 w-8 animate-pulse text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">Loading listings...</p>
            </div>
          ) : filteredListings.length === 0 ? (
            <div className="p-8 text-center">
              <Package className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">No listings found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Listing</TableHead>
                  <TableHead>Seller</TableHead>
                  <TableHead>Section</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Views</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredListings.map((listing) => (
                  <TableRow key={listing.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="relative w-10 h-10 rounded bg-muted overflow-hidden flex-shrink-0">
                          {listing.listing_images?.[0]?.url ? (
                            <Image
                              src={listing.listing_images[0].url || "/placeholder.svg"}
                              alt=""
                              fill
                              className="object-contain"
                              style={{ objectFit: "contain" }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Package className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        <span className="font-medium text-foreground line-clamp-1 max-w-[200px]">
                          {capitalizeWords(listing.title)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {listing.profiles?.display_name || 'Unknown'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {listing.section}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-semibold text-black dark:text-white">${listing.price}</TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(listing.status)}>
                        {listing.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{listing.views}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(listing.created_at), 'MMM d, yyyy')}
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
                            <Link href={getListingViewHref(listing.section, listing.id, listing.slug)}>
                              <Eye className="h-4 w-4 mr-2" /> View
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => editListing(listing)}>
                            <Pencil className="h-4 w-4 mr-2" /> Edit Listing
                          </DropdownMenuItem>
                          {listing.status === 'active' && (
                            <DropdownMenuItem onClick={() => updateListingStatus(listing.id, 'removed')}>
                              <Flag className="h-4 w-4 mr-2" /> Remove
                            </DropdownMenuItem>
                          )}
                          {listing.status === 'removed' && (
                            <DropdownMenuItem onClick={() => updateListingStatus(listing.id, 'active')}>
                              Restore
                            </DropdownMenuItem>
                          )}
                          {listing.status === 'sold' && (
                            <DropdownMenuItem
                              onClick={() => {
                                if (
                                  !confirm(
                                    'Make this listing live again? It was marked sold—only do this if the sale was reversed or was a mistake.'
                                  )
                                )
                                  return
                                updateListingStatus(listing.id, 'active')
                              }}
                            >
                              <RotateCcw className="h-4 w-4 mr-2" /> Reactivate (make live)
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem 
                            className="text-destructive focus:text-destructive"
                            onClick={() => deleteListing(listing.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" /> Delete
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
