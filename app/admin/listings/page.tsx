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
import { SiteSearchBar, siteSearchInputClassName } from '@/components/site-search-bar'
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { MoreVertical, Eye, EyeOff, Trash2, Flag, Package, RotateCcw, Pencil, Tag, Layers } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { capitalizeWords } from '@/lib/listing-labels'
import { getAdminSession } from '@/app/actions/account'

function normalizeCategoryId(id: string | undefined | null): string {
  return (id ?? '').trim().toLowerCase()
}

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
  category_id: string
  categories: { name: string } | null
  hidden_from_site?: boolean | null
  profiles: { display_name: string; email: string }
  listing_images: { url: string }[]
}

interface CategoryOption {
  id: string
  name: string
  board: boolean
}

export default function AdminListingsPage() {
  const router = useRouter()
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sectionFilter, setSectionFilter] = useState('all')
  const [isAdminUser, setIsAdminUser] = useState(false)
  const [categoryDialogListing, setCategoryDialogListing] = useState<Listing | null>(null)
  const [categoryPick, setCategoryPick] = useState('')
  const [categorySaving, setCategorySaving] = useState(false)
  const [dialogCategoryRows, setDialogCategoryRows] = useState<CategoryOption[]>([])
  const [dialogCategoriesLoading, setDialogCategoriesLoading] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    fetchListings()
  }, [statusFilter, sectionFilter])

  useEffect(() => {
    let cancelled = false
    getAdminSession()
      .then((d: { isAdmin?: boolean }) => {
        if (!cancelled) setIsAdminUser(d.isAdmin === true)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!categoryDialogListing) {
      setDialogCategoryRows([])
      return
    }

    const listing = categoryDialogListing
    const section =
      listing.section === 'surfboards' || listing.section === 'new' ? listing.section : null
    if (!section) {
      setDialogCategoryRows([])
      return
    }

    let cancelled = false
    setDialogCategoriesLoading(true)

    void fetch(`/api/admin/categories?section=${encodeURIComponent(section)}`, {
      credentials: 'include',
    })
      .then(async (res) => {
        const json = (await res.json()) as { categories?: CategoryOption[]; error?: string }
        if (cancelled) return
        if (!res.ok) {
          toast.error(typeof json.error === 'string' ? json.error : 'Failed to load categories')
          setDialogCategoryRows([])
          return
        }
        let rows = [...(json.categories ?? [])]
        const targetId = listing.category_id.trim().toLowerCase()
        const hasCurrent = rows.some((r) => r.id.trim().toLowerCase() === targetId)
        if (!hasCurrent) {
          rows.push({
            id: listing.category_id.trim(),
            name: listing.categories?.name ?? 'Current category',
            board: section === 'surfboards',
          })
        }
        rows.sort((a, b) => a.name.localeCompare(b.name))
        setDialogCategoryRows(rows)
        const target = listing.category_id.trim().toLowerCase()
        const match = rows.find((r) => r.id.trim().toLowerCase() === target)
        if (match) {
          setCategoryPick(match.id)
        }
      })
      .catch(() => {
        if (!cancelled) {
          toast.error('Failed to load categories')
          setDialogCategoryRows([])
        }
      })
      .finally(() => {
        if (!cancelled) setDialogCategoriesLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [categoryDialogListing])

  async function fetchListings() {
    const params = new URLSearchParams()
    if (statusFilter !== 'all') params.set('status', statusFilter)
    if (sectionFilter !== 'all') params.set('section', sectionFilter)

    try {
      const res = await fetch(`/api/admin/listings?${params.toString()}`, {
        credentials: 'include',
      })
      const json = (await res.json()) as { listings?: Listing[]; error?: string }

      if (!res.ok) {
        toast.error(typeof json.error === 'string' ? json.error : 'Failed to load listings')
        setListings([])
        return
      }

      setListings(json.listings ?? [])
    } catch {
      toast.error('Failed to load listings')
      setListings([])
    } finally {
      setLoading(false)
    }
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

  async function toggleSiteVisibility(listing: Listing) {
    const next = !Boolean(listing.hidden_from_site)
    const res = await fetch(
      `/api/admin/listings/${encodeURIComponent(listing.id)}/site-visibility`,
      {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hidden_from_site: next }),
      },
    )
    if (res.ok) {
      setListings((prev) =>
        prev.map((l) => (l.id === listing.id ? { ...l, hidden_from_site: next } : l)),
      )
      toast.success(next ? 'Hidden from site' : 'Visible on site again')
    } else {
      const data = await res.json().catch(() => ({ error: 'Failed to update' }))
      toast.error(typeof data.error === 'string' ? data.error : 'Failed to update visibility')
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

  async function saveListingCategory() {
    if (!categoryDialogListing) return
    const nextId = normalizeCategoryId(categoryPick)
    if (!nextId) {
      toast.error('Select a category')
      return
    }
    const currentId = normalizeCategoryId(categoryDialogListing.category_id)
    if (currentId && nextId === currentId) {
      setCategoryDialogListing(null)
      return
    }

    setCategorySaving(true)
    try {
      const res = await fetch(
        `/api/admin/listings/${encodeURIComponent(categoryDialogListing.id)}/category`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category_id: categoryPick.trim() }),
        },
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(typeof data.error === 'string' ? data.error : 'Failed to update category')
        return
      }
      const label =
        dialogCategoryRows.find((c) => c.id === categoryPick)?.name ??
        categoryDialogListing.categories?.name ??
        'Category'
      setListings((prev) =>
        prev.map((l) =>
          l.id === categoryDialogListing.id
            ? {
                ...l,
                category_id: categoryPick.trim(),
                categories: { name: label },
              }
            : l,
        ),
      )
      toast.success('Category updated')
      setCategoryDialogListing(null)
    } finally {
      setCategorySaving(false)
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
        <div className="flex flex-wrap gap-2">
          {isAdminUser ? (
            <Button variant="outline" asChild>
              <Link href="/admin/listings/brand-requests">
                <Tag className="h-4 w-4 mr-2" />
                Brand requests
              </Link>
            </Button>
          ) : null}
          <Button asChild>
            <Link href="/admin/listings/add">
              <Package className="h-4 w-4 mr-2" />
              Add listing (for user)
            </Link>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <SiteSearchBar
              className="flex-1 md:min-w-0"
              onSubmit={(e) => {
                e.preventDefault()
              }}
            >
              <Input
                placeholder="Search by title or seller..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={siteSearchInputClassName()}
              />
            </SiteSearchBar>
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
                <SelectItem value="surfboards">Surfboards</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={categoryDialogListing !== null}
        onOpenChange={(open) => {
          if (!open) setCategoryDialogListing(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change category</DialogTitle>
          </DialogHeader>
          {categoryDialogListing ? (
            <div className="space-y-3 py-1">
              <p className="text-sm text-muted-foreground line-clamp-2">
                {capitalizeWords(categoryDialogListing.title)}
              </p>
              <Select
                value={categoryPick || undefined}
                onValueChange={setCategoryPick}
                disabled={dialogCategoriesLoading}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      dialogCategoriesLoading ? 'Loading categories…' : 'Select category'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {dialogCategoryRows.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              className="shrink-0"
              onClick={() => setCategoryDialogListing(null)}
              disabled={categorySaving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="default"
              className="min-w-[5.5rem] shrink-0 disabled:opacity-100 disabled:bg-muted disabled:text-foreground disabled:border disabled:border-border"
              onClick={() => void saveListingCategory()}
              disabled={
                categorySaving ||
                dialogCategoriesLoading ||
                dialogCategoryRows.length === 0 ||
                !normalizeCategoryId(categoryPick)
              }
              aria-label={categorySaving ? 'Saving category' : 'Save category'}
            >
              {categorySaving ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                  <TableHead>Category</TableHead>
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
                              className="object-cover object-center"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Package className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="font-medium text-foreground line-clamp-1 max-w-[200px]">
                            {capitalizeWords(listing.title)}
                          </span>
                          {listing.hidden_from_site ? (
                            <Badge variant="secondary" className="shrink-0 text-[10px] font-normal">
                              Hidden from site
                            </Badge>
                          ) : null}
                        </div>
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
                    <TableCell className="text-muted-foreground max-w-[140px]">
                      <span className="line-clamp-2 text-sm">
                        {listing.categories?.name ?? '—'}
                      </span>
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
                          <DropdownMenuItem
                            onClick={() => {
                              setCategoryPick(listing.category_id.trim())
                              setCategoryDialogListing(listing)
                            }}
                          >
                            <Layers className="h-4 w-4 mr-2" /> Change category
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toggleSiteVisibility(listing)}>
                            {listing.hidden_from_site ? (
                              <>
                                <Eye className="h-4 w-4 mr-2" /> Show on site
                              </>
                            ) : (
                              <>
                                <EyeOff className="h-4 w-4 mr-2" /> Hide from site
                              </>
                            )}
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
