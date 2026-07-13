'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { listingDetailHref } from '@/lib/listing-href'
import { proxiedListingImageSrc } from '@/lib/listing-media-proxy-url'
import { setImpersonation } from '@/lib/impersonation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SiteSearchBar, siteSearchInputClassName } from '@/components/site-search-bar'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
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
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Boxes,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Columns3,
  DollarSign,
  Download,
  Eye,
  EyeOff,
  Flag,
  Layers,
  MoreVertical,
  Package,
  Pencil,
  RotateCcw,
  Tag,
  Trash2,
  TrendingUp,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { format, formatDistanceToNow } from 'date-fns'
import { capitalizeWords } from '@/lib/listing-labels'
import { cn } from '@/lib/utils'
import { getAdminSession } from '@/app/actions/account'
import {
  AdminListingsChart,
  type MonthlyListingPoint,
} from '@/components/features/admin/admin-listings-chart'

function normalizeCategoryId(id: string | undefined | null): string {
  return (id ?? '').trim().toLowerCase()
}

function formatUsd(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount)
}

function compactUsd(amount: number): string {
  if (Math.abs(amount) >= 10000) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(amount)
  }
  return formatUsd(amount)
}

function compactNumber(value: number): string {
  return new Intl.NumberFormat('en-US', {
    notation: value >= 10000 ? 'compact' : 'standard',
    maximumFractionDigits: 1,
  }).format(value)
}

function mapMonthlyCreatedToChartPoints(
  rows: { month_key: string; listing_count: number }[],
): MonthlyListingPoint[] {
  return rows.map((row) => {
    const monthDate = new Date(`${row.month_key}-01T00:00:00`)
    return {
      month: row.month_key,
      label: Number.isNaN(monthDate.getTime()) ? row.month_key : format(monthDate, 'MMM yyyy'),
      count: row.listing_count,
    }
  })
}

function sellerInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
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
  brand?: string | null
  model?: string | null
  brand_id?: string | null
  brand_model_id?: string | null
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

type AdminListingSection =
  | 'surfboards'
  | 'new'
  | 'fins'
  | 'wetsuits'
  | 'boardbags'
  | 'surfpacks'
  | 'leashes'
  | 'apparel'
  | 'accessories'
  | 'magazines'

const ADMIN_LISTING_SECTION_VALUES: readonly AdminListingSection[] = [
  'surfboards',
  'new',
  'fins',
  'wetsuits',
  'boardbags',
  'surfpacks',
  'leashes',
  'apparel',
  'accessories',
  'magazines',
]

/**
 * Peer sections that resolve to a single fixed category and have a dedicated
 * /sell sub-flow (admin edit goes straight there, like fins).
 */
const PEER_SELL_ROUTE_BY_SECTION: Partial<Record<AdminListingSection, string>> = {
  fins: '/sell/fins',
  wetsuits: '/sell/wetsuits',
  boardbags: '/sell/boardbags',
  surfpacks: '/sell/surfpacks',
  leashes: '/sell/leashes',
  apparel: '/sell/apparel',
  accessories: '/sell/accessories',
  magazines: '/sell/magazines',
}

const ADMIN_LISTING_SECTION_LABELS: Record<AdminListingSection, string> = {
  surfboards: 'Surfboards',
  new: 'New',
  fins: 'Fins',
  wetsuits: 'Wetsuits',
  boardbags: 'Boardbags',
  surfpacks: 'Surfpacks',
  leashes: 'Leashes',
  apparel: 'Apparel',
  accessories: 'Accessories',
  magazines: 'Magazines',
}

function normalizeListingSection(section: string | undefined | null): AdminListingSection | null {
  if (section && (ADMIN_LISTING_SECTION_VALUES as readonly string[]).includes(section)) {
    return section as AdminListingSection
  }
  return null
}

function formatListingSectionLabel(section: string): string {
  const normalized = normalizeListingSection(section)
  return normalized ? ADMIN_LISTING_SECTION_LABELS[normalized] : section
}

type SortKey = 'created_at' | 'price' | 'views' | 'title'
type SortDir = 'asc' | 'desc'

const STATUS_META: Record<string, { label: string; dot: string; badge: string }> = {
  active: {
    label: 'Active',
    dot: 'bg-emerald-500',
    badge: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  },
  sold: {
    label: 'Sold',
    dot: 'bg-sky-500',
    badge: 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-400',
  },
  pending: {
    label: 'Pending',
    dot: 'bg-amber-500',
    badge: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  },
  pending_sale: {
    label: 'Pending sale',
    dot: 'bg-violet-500',
    badge: 'border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-400',
  },
  draft: {
    label: 'Draft',
    dot: 'bg-muted-foreground/50',
    badge: 'border-border bg-muted text-muted-foreground',
  },
  removed: {
    label: 'Removed',
    dot: 'bg-rose-500',
    badge: 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400',
  },
}

function statusMeta(status: string) {
  return (
    STATUS_META[status] ?? {
      label: capitalizeWords(status.replace(/_/g, ' ')),
      dot: 'bg-muted-foreground/50',
      badge: 'border-border bg-muted text-muted-foreground',
    }
  )
}

const PAGE_SIZE_OPTIONS = [25, 50, 100]

const TOGGLEABLE_COLUMNS = [
  { key: 'seller', label: 'Seller' },
  { key: 'section', label: 'Section' },
  { key: 'brand', label: 'Brand / model' },
  { key: 'views', label: 'Views' },
  { key: 'date', label: 'Date' },
] as const

type ColumnKey = (typeof TOGGLEABLE_COLUMNS)[number]['key']
type ColumnVisibility = Record<ColumnKey, boolean>

const DEFAULT_COLUMNS: ColumnVisibility = {
  seller: true,
  section: true,
  brand: true,
  views: true,
  date: true,
}

function csvCell(value: unknown): string {
  const str = value == null ? '' : String(value)
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
}

function downloadListingsCsv(rows: Listing[]): void {
  const header = [
    'id',
    'title',
    'seller',
    'email',
    'section',
    'category',
    'brand',
    'model',
    'price',
    'status',
    'hidden_from_site',
    'views',
    'created_at',
  ]
  const lines = rows.map((l) =>
    [
      l.id,
      l.title,
      l.profiles?.display_name ?? '',
      l.profiles?.email ?? '',
      l.section,
      l.categories?.name ?? '',
      l.brand ?? '',
      l.model ?? '',
      Number(l.price) || 0,
      l.status,
      l.hidden_from_site ? 'yes' : 'no',
      Number(l.views) || 0,
      format(new Date(l.created_at), 'yyyy-MM-dd'),
    ]
      .map(csvCell)
      .join(','),
  )
  const csv = [header.join(','), ...lines].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `reswell-listings-${format(new Date(), 'yyyy-MM-dd')}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

interface StatTileProps {
  icon: typeof Package
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

export default function AdminListingsPage() {
  const router = useRouter()
  const [listings, setListings] = useState<Listing[]>([])
  const [monthlyListings, setMonthlyListings] = useState<MonthlyListingPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sectionFilter, setSectionFilter] = useState('all')
  const [visibilityFilter, setVisibilityFilter] = useState('all')
  const [sortKey, setSortKey] = useState<SortKey>('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [columns, setColumns] = useState<ColumnVisibility>(DEFAULT_COLUMNS)
  const [bulkBusy, setBulkBusy] = useState(false)
  const [isAdminUser, setIsAdminUser] = useState(false)
  const [categoryDialogListing, setCategoryDialogListing] = useState<Listing | null>(null)
  const [sectionPick, setSectionPick] = useState<AdminListingSection>('surfboards')
  const [categoryPick, setCategoryPick] = useState('')
  const [categorySaving, setCategorySaving] = useState(false)
  const [dialogCategoryRows, setDialogCategoryRows] = useState<CategoryOption[]>([])
  const [dialogCategoriesLoading, setDialogCategoriesLoading] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    void fetchListings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  // Reset to first page whenever the working set changes.
  useEffect(() => {
    setPage(1)
  }, [searchQuery, statusFilter, sectionFilter, visibilityFilter, pageSize, sortKey, sortDir])

  useEffect(() => {
    if (!categoryDialogListing) {
      setDialogCategoryRows([])
      return
    }

    const section = sectionPick

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
        const rows = [...(json.categories ?? [])]
        const listing = categoryDialogListing
        const targetId = listing.category_id.trim().toLowerCase()
        const hasCurrent = rows.some((r) => r.id.trim().toLowerCase() === targetId)
        if (!hasCurrent && section === normalizeListingSection(listing.section)) {
          rows.push({
            id: listing.category_id.trim(),
            name: listing.categories?.name ?? 'Current category',
            board: section === 'surfboards',
          })
        }
        rows.sort((a, b) => a.name.localeCompare(b.name))
        setDialogCategoryRows(rows)
        if (PEER_SELL_ROUTE_BY_SECTION[section] && rows[0]) {
          setCategoryPick(rows[0].id)
          return
        }
        const match = rows.find((r) => r.id.trim().toLowerCase() === targetId)
        if (match) {
          setCategoryPick(match.id)
        } else if (rows[0]) {
          setCategoryPick(rows[0].id)
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
  }, [categoryDialogListing, sectionPick])

  async function fetchListings() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/listings', { credentials: 'include' })
      const json = (await res.json()) as {
        listings?: Listing[]
        monthlyCreated?: { month_key: string; listing_count: number }[]
        error?: string
      }
      if (!res.ok) {
        toast.error(typeof json.error === 'string' ? json.error : 'Failed to load listings')
        setListings([])
        setMonthlyListings([])
        return
      }
      setListings(json.listings ?? [])
      setMonthlyListings(mapMonthlyCreatedToChartPoints(json.monthlyCreated ?? []))
    } catch {
      toast.error('Failed to load listings')
      setListings([])
      setMonthlyListings([])
    } finally {
      setLoading(false)
    }
  }

  async function updateListingStatus(id: string, newStatus: string) {
    const res = await fetch('/api/admin/listings/status', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listing_ids: [id], status: newStatus }),
    })
    const json = (await res.json().catch(() => ({}))) as {
      success?: boolean
      error?: unknown
    }
    if (res.ok) {
      setListings((prev) =>
        prev.map((l) =>
          l.id === id
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

  async function setVisibilityRequest(id: string, hidden: boolean): Promise<boolean> {
    const res = await fetch(`/api/admin/listings/${encodeURIComponent(id)}/site-visibility`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hidden_from_site: hidden }),
    })
    return res.ok
  }

  async function toggleSiteVisibility(listing: Listing) {
    const next = !Boolean(listing.hidden_from_site)
    const ok = await setVisibilityRequest(listing.id, next)
    if (ok) {
      setListings((prev) =>
        prev.map((l) => (l.id === listing.id ? { ...l, hidden_from_site: next } : l)),
      )
      toast.success(next ? 'Hidden from site' : 'Visible on site again')
    } else {
      toast.error('Failed to update visibility')
    }
  }

  async function deleteListingRequest(id: string): Promise<{ ok: boolean; error?: string }> {
    const res = await fetch(`/api/admin/listings?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    if (res.ok) return { ok: true }
    const data = await res.json().catch(() => ({ error: 'Failed to delete listing' }))
    return { ok: false, error: typeof data.error === 'string' ? data.error : 'Failed to delete' }
  }

  async function deleteListing(id: string) {
    if (!confirm('Permanently delete this listing? This cannot be undone.')) return
    const result = await deleteListingRequest(id)
    if (result.ok) {
      setListings((prev) => prev.filter((l) => l.id !== id))
      setSelectedIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      toast.success('Listing deleted')
    } else {
      toast.error(result.error ?? 'Failed to delete listing')
    }
  }

  async function editListing(listing: Listing) {
    const displayName = listing.profiles?.display_name || 'User'
    const email = listing.profiles?.email || null
    const res = await fetch('/api/admin/impersonate', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: listing.user_id, displayName, email }),
    })
    if (res.ok) {
      setImpersonation({ userId: listing.user_id, displayName, email })
      const normalizedSection = normalizeListingSection(listing.section)
      const peerSellRoute = normalizedSection
        ? PEER_SELL_ROUTE_BY_SECTION[normalizedSection]
        : undefined
      const editPath = peerSellRoute
        ? `${peerSellRoute}?edit=${listing.id}`
        : `/sell?edit=${listing.id}`
      router.push(editPath)
    } else {
      toast.error('Failed to start impersonation for editing')
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
    const currentSection = normalizeListingSection(categoryDialogListing.section)
    if (currentId && nextId === currentId && currentSection === sectionPick) {
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
          body: JSON.stringify({ section: sectionPick, category_id: categoryPick.trim() }),
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
                section: sectionPick,
                category_id: categoryPick.trim(),
                categories: { name: label },
              }
            : l,
        ),
      )
      toast.success('Listing type updated')
      setCategoryDialogListing(null)
    } finally {
      setCategorySaving(false)
    }
  }

  // --- Derived data ------------------------------------------------------

  const stats = useMemo(() => {
    let active = 0
    let sold = 0
    let hidden = 0
    let inventoryValue = 0
    let views = 0
    for (const l of listings) {
      if (l.status === 'active') {
        active += 1
        inventoryValue += Number(l.price) || 0
      }
      if (l.status === 'sold') sold += 1
      if (l.hidden_from_site) hidden += 1
      views += Number(l.views) || 0
    }
    return { total: listings.length, active, sold, hidden, inventoryValue, views }
  }, [listings])

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const result = listings.filter((listing) => {
      if (statusFilter !== 'all' && listing.status !== statusFilter) return false
      if (sectionFilter !== 'all' && listing.section !== sectionFilter) return false
      if (visibilityFilter === 'hidden' && !listing.hidden_from_site) return false
      if (visibilityFilter === 'visible' && listing.hidden_from_site) return false
      if (!q) return true
      const brand = (listing.brand ?? '').toLowerCase()
      const model = (listing.model ?? '').toLowerCase()
      return (
        listing.title.toLowerCase().includes(q) ||
        (listing.profiles?.display_name?.toLowerCase().includes(q) ?? false) ||
        (listing.profiles?.email?.toLowerCase().includes(q) ?? false) ||
        brand.includes(q) ||
        model.includes(q)
      )
    })

    const dir = sortDir === 'asc' ? 1 : -1
    result.sort((a, b) => {
      switch (sortKey) {
        case 'price':
          return (Number(a.price) - Number(b.price)) * dir
        case 'views':
          return (Number(a.views) - Number(b.views)) * dir
        case 'title':
          return a.title.localeCompare(b.title) * dir
        case 'created_at':
        default:
          return (
            (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * dir
          )
      }
    })
    return result
  }, [listings, searchQuery, statusFilter, sectionFilter, visibilityFilter, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pageStart = (currentPage - 1) * pageSize
  const pageRows = filtered.slice(pageStart, pageStart + pageSize)

  const pageIds = pageRows.map((l) => l.id)
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id))
  const somePageSelected = pageIds.some((id) => selectedIds.has(id))

  function toggleSelectAllOnPage() {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allPageSelected) {
        pageIds.forEach((id) => next.delete(id))
      } else {
        pageIds.forEach((id) => next.add(id))
      }
      return next
    })
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'title' ? 'asc' : 'desc')
    }
  }

  const selectedListings = useMemo(
    () => listings.filter((l) => selectedIds.has(l.id)),
    [listings, selectedIds],
  )

  async function bulkSetVisibility(hidden: boolean) {
    const targets = selectedListings.filter((l) => Boolean(l.hidden_from_site) !== hidden)
    if (targets.length === 0) {
      toast.info(hidden ? 'Selection already hidden' : 'Selection already visible')
      return
    }
    setBulkBusy(true)
    const results = await Promise.all(targets.map((l) => setVisibilityRequest(l.id, hidden)))
    const okIds = new Set(targets.filter((_, i) => results[i]).map((l) => l.id))
    setListings((prev) =>
      prev.map((l) => (okIds.has(l.id) ? { ...l, hidden_from_site: hidden } : l)),
    )
    const failed = results.filter((r) => !r).length
    setBulkBusy(false)
    if (failed === 0) toast.success(`${okIds.size} ${hidden ? 'hidden' : 'made visible'}`)
    else toast.warning(`${okIds.size} updated, ${failed} failed`)
  }

  async function bulkSetStatus(status: string) {
    if (selectedListings.length === 0) return
    setBulkBusy(true)
    const ids = selectedListings.map((l) => l.id)
    const res = await fetch('/api/admin/listings/status', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listing_ids: ids, status }),
    })
    setBulkBusy(false)
    if (!res.ok) {
      toast.error('Failed to update selection')
      return
    }
    const idSet = new Set(ids)
    setListings((prev) =>
      prev.map((l) =>
        idSet.has(l.id)
          ? {
              ...l,
              status,
              hidden_from_site: status === 'removed' ? true : l.hidden_from_site,
            }
          : l,
      ),
    )
    toast.success(`${ids.length} marked as ${status}`)
  }

  async function bulkDelete() {
    if (selectedListings.length === 0) return
    if (
      !confirm(
        `Permanently delete ${selectedListings.length} listing${
          selectedListings.length === 1 ? '' : 's'
        }? This cannot be undone.`,
      )
    )
      return
    setBulkBusy(true)
    const results = await Promise.all(selectedListings.map((l) => deleteListingRequest(l.id)))
    const deletedIds = new Set(
      selectedListings.filter((_, i) => results[i].ok).map((l) => l.id),
    )
    setListings((prev) => prev.filter((l) => !deletedIds.has(l.id)))
    setSelectedIds((prev) => {
      const next = new Set(prev)
      deletedIds.forEach((id) => next.delete(id))
      return next
    })
    const failed = results.filter((r) => !r.ok).length
    setBulkBusy(false)
    if (failed === 0) toast.success(`${deletedIds.size} deleted`)
    else toast.warning(`${deletedIds.size} deleted, ${failed} could not be removed (order history)`)
  }

  function getListingViewHref(section: string, id: string, slug?: string | null) {
    return listingDetailHref({ id, slug, section })
  }

  function SortHeader({ label, sortKey: key, className }: { label: string; sortKey: SortKey; className?: string }) {
    const active = sortKey === key
    const Icon = !active ? ArrowUpDown : sortDir === 'asc' ? ArrowUp : ArrowDown
    return (
      <button
        type="button"
        onClick={() => toggleSort(key)}
        className={cn(
          'inline-flex items-center gap-1 text-left font-medium transition-colors hover:text-foreground',
          active ? 'text-foreground' : 'text-muted-foreground',
          className,
        )}
      >
        {label}
        <Icon className="h-3.5 w-3.5" aria-hidden />
      </button>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="font-headline text-3xl font-bold tracking-tight text-foreground">Listings</h1>
            <span className="inline-flex items-center rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-medium tabular-nums text-muted-foreground">
              {loading ? 'Loading…' : `${stats.total} total`}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Search, moderate, and bulk-manage every listing across the marketplace.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isAdminUser ? (
            <>
              <Button variant="outline" asChild>
                <Link href="/admin/listings/bulk">
                  <Layers className="mr-2 h-4 w-4" />
                  Bulk list
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/admin/listings/brand-requests">
                  <Tag className="mr-2 h-4 w-4" />
                  Brand &amp; model requests
                </Link>
              </Button>
            </>
          ) : null}
          <Button variant="outline" asChild>
            <Link href="/admin/listings/add">
              <Package className="mr-2 h-4 w-4" />
              Add listing (for user)
            </Link>
          </Button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatTile icon={Boxes} accent="neutral" label="Total" value={compactNumber(stats.total)} />
        <StatTile
          icon={Package}
          accent="emerald"
          label="Active"
          value={compactNumber(stats.active)}
          hint={stats.total > 0 ? `${Math.round((stats.active / stats.total) * 100)}% of catalog` : undefined}
        />
        <StatTile icon={Tag} accent="sky" label="Sold" value={compactNumber(stats.sold)} />
        <StatTile
          icon={EyeOff}
          accent="amber"
          label="Hidden"
          value={compactNumber(stats.hidden)}
          hint="From site"
        />
        <StatTile
          icon={DollarSign}
          accent="violet"
          label="Active value"
          value={compactUsd(stats.inventoryValue)}
          hint="Live inventory"
        />
        <StatTile icon={TrendingUp} accent="neutral" label="Total views" value={compactNumber(stats.views)} />
      </div>

      {/* Listing trend */}
      {loading ? (
        <div className="h-[360px] animate-pulse rounded-2xl border border-border bg-card" />
      ) : (
        <AdminListingsChart data={monthlyListings} />
      )}

      {/* Toolbar */}
      <div className="rounded-2xl border border-border bg-card p-3">
        <div className="flex flex-col gap-3">
          <SiteSearchBar className="w-full" onSubmit={(e) => e.preventDefault()}>
            <Input
              placeholder="Search by title, seller, email, brand, or model…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={siteSearchInputClassName()}
            />
          </SiteSearchBar>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:flex md:flex-wrap">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="lg:w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="sold">Sold</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="pending_sale">Pending sale</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="removed">Removed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sectionFilter} onValueChange={setSectionFilter}>
              <SelectTrigger className="lg:w-36">
                <SelectValue placeholder="Section" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sections</SelectItem>
                <SelectItem value="surfboards">Surfboards</SelectItem>
                <SelectItem value="fins">Fins</SelectItem>
                <SelectItem value="wetsuits">Wetsuits</SelectItem>
                <SelectItem value="boardbags">Boardbags</SelectItem>
                <SelectItem value="surfpacks">Surfpacks</SelectItem>
                <SelectItem value="leashes">Leashes</SelectItem>
                <SelectItem value="apparel">Apparel</SelectItem>
                <SelectItem value="accessories">Accessories</SelectItem>
                <SelectItem value="magazines">Magazines</SelectItem>
                <SelectItem value="new">New &amp; retail</SelectItem>
              </SelectContent>
            </Select>
            <Select value={visibilityFilter} onValueChange={setVisibilityFilter}>
              <SelectTrigger className="lg:w-36">
                <SelectValue placeholder="Visibility" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All visibility</SelectItem>
                <SelectItem value="visible">Visible</SelectItem>
                <SelectItem value="hidden">Hidden</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={`${sortKey}:${sortDir}`}
              onValueChange={(v) => {
                const [k, d] = v.split(':') as [SortKey, SortDir]
                setSortKey(k)
                setSortDir(d)
              }}
            >
              <SelectTrigger className="lg:w-40">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created_at:desc">Newest first</SelectItem>
                <SelectItem value="created_at:asc">Oldest first</SelectItem>
                <SelectItem value="price:desc">Price: high → low</SelectItem>
                <SelectItem value="price:asc">Price: low → high</SelectItem>
                <SelectItem value="views:desc">Most viewed</SelectItem>
                <SelectItem value="title:asc">Title A → Z</SelectItem>
              </SelectContent>
            </Select>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Columns3 className="h-4 w-4" />
                  <span className="hidden sm:inline">Columns</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {TOGGLEABLE_COLUMNS.map((col) => (
                  <DropdownMenuCheckboxItem
                    key={col.key}
                    checked={columns[col.key]}
                    onCheckedChange={(checked) =>
                      setColumns((prev) => ({ ...prev, [col.key]: checked === true }))
                    }
                    onSelect={(e) => e.preventDefault()}
                  >
                    {col.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="outline"
              className="gap-2"
              disabled={loading || filtered.length === 0}
              onClick={() => downloadListingsCsv(filtered)}
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Export</span>
            </Button>
          </div>
        </div>
        {!loading &&
        (filtered.length !== listings.length ||
          searchQuery ||
          statusFilter !== 'all' ||
          sectionFilter !== 'all' ||
          visibilityFilter !== 'all') ? (
          <div className="mt-2 flex flex-wrap items-center gap-2 px-1">
            <span className="text-xs text-muted-foreground">
              {filtered.length} match{filtered.length === 1 ? '' : 'es'} of {listings.length} listings
            </span>
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2 py-0.5 text-xs text-foreground transition-colors hover:border-foreground/20"
              >
                “{searchQuery}”
                <X className="h-3 w-3" />
              </button>
            ) : null}
            {statusFilter !== 'all' ? (
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2 py-0.5 text-xs capitalize text-foreground transition-colors hover:border-foreground/20"
              >
                {statusFilter.replace(/_/g, ' ')}
                <X className="h-3 w-3" />
              </button>
            ) : null}
            {sectionFilter !== 'all' ? (
              <button
                type="button"
                onClick={() => setSectionFilter('all')}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2 py-0.5 text-xs text-foreground transition-colors hover:border-foreground/20"
              >
                {formatListingSectionLabel(sectionFilter)}
                <X className="h-3 w-3" />
              </button>
            ) : null}
            {visibilityFilter !== 'all' ? (
              <button
                type="button"
                onClick={() => setVisibilityFilter('all')}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2 py-0.5 text-xs capitalize text-foreground transition-colors hover:border-foreground/20"
              >
                {visibilityFilter}
                <X className="h-3 w-3" />
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 ? (
        <div className="sticky top-2 z-10 flex flex-wrap items-center gap-2 rounded-2xl border border-foreground/15 bg-card/95 p-2.5 pl-4 shadow-md backdrop-blur supports-[backdrop-filter]:bg-card/80">
          <span className="text-sm font-medium tabular-nums text-foreground">
            {selectedIds.size} selected
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" disabled={bulkBusy} onClick={() => void bulkSetVisibility(false)}>
              <Eye className="mr-1.5 h-4 w-4" /> Show
            </Button>
            <Button variant="outline" size="sm" disabled={bulkBusy} onClick={() => void bulkSetVisibility(true)}>
              <EyeOff className="mr-1.5 h-4 w-4" /> Hide
            </Button>
            <Button variant="outline" size="sm" disabled={bulkBusy} onClick={() => void bulkSetStatus('removed')}>
              <Flag className="mr-1.5 h-4 w-4" /> Remove
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={bulkBusy || selectedListings.length === 0}
              onClick={() => downloadListingsCsv(selectedListings)}
            >
              <Download className="mr-1.5 h-4 w-4" /> Export
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={bulkBusy}
              className="text-destructive hover:text-destructive"
              onClick={() => void bulkDelete()}
            >
              <Trash2 className="mr-1.5 h-4 w-4" /> Delete
            </Button>
            <Button variant="ghost" size="sm" disabled={bulkBusy} onClick={() => setSelectedIds(new Set())}>
              <X className="mr-1.5 h-4 w-4" /> Clear
            </Button>
          </div>
        </div>
      ) : null}

      {/* Category dialog */}
      <Dialog
        open={categoryDialogListing !== null}
        onOpenChange={(open) => {
          if (!open) setCategoryDialogListing(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change listing type</DialogTitle>
          </DialogHeader>
          {categoryDialogListing ? (
            <div className="space-y-4 py-1">
              <p className="line-clamp-2 text-sm text-muted-foreground">
                {capitalizeWords(categoryDialogListing.title)}
              </p>
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Listing type</p>
                <Select
                  value={sectionPick}
                  onValueChange={(value) => setSectionPick(value as AdminListingSection)}
                  disabled={categorySaving}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="surfboards">Surfboard</SelectItem>
                    <SelectItem value="fins">Fins</SelectItem>
                    <SelectItem value="wetsuits">Wetsuit</SelectItem>
                    <SelectItem value="boardbags">Boardbag</SelectItem>
                    <SelectItem value="surfpacks">Surfpack</SelectItem>
                    <SelectItem value="leashes">Leash</SelectItem>
                    <SelectItem value="apparel">Apparel</SelectItem>
                    <SelectItem value="accessories">Accessories</SelectItem>
                <SelectItem value="magazines">Magazines</SelectItem>
                    <SelectItem value="new">Shop / retail</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {PEER_SELL_ROUTE_BY_SECTION[sectionPick] ? (
                <p className="text-sm text-muted-foreground">
                  {ADMIN_LISTING_SECTION_LABELS[sectionPick]} listings use the marketplace{' '}
                  {ADMIN_LISTING_SECTION_LABELS[sectionPick]} category.
                </p>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">Category</p>
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
              )}
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
              className="min-w-[5.5rem] shrink-0 disabled:border disabled:border-border disabled:bg-muted disabled:text-foreground disabled:opacity-100"
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

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {loading ? (
          <div className="divide-y divide-border">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-4">
                <div className="h-12 w-12 shrink-0 animate-pulse rounded-lg bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-1/3 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-1/4 animate-pulse rounded bg-muted" />
                </div>
                <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
              <Package className="h-6 w-6 text-muted-foreground" />
            </span>
            <p className="mt-3 font-medium text-foreground">No listings found</p>
            <p className="text-sm text-muted-foreground">
              {listings.length === 0
                ? 'There are no listings yet.'
                : 'Try adjusting your search or filters.'}
            </p>
            {listings.length > 0 ? (
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => {
                  setSearchQuery('')
                  setStatusFilter('all')
                  setSectionFilter('all')
                  setVisibilityFilter('all')
                }}
              >
                Reset filters
              </Button>
            ) : null}
          </div>
        ) : (
          <Table className="[&_td]:px-3 [&_td]:py-2.5 [&_th]:px-3">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-10 pl-4">
                  <Checkbox
                    checked={allPageSelected}
                    onCheckedChange={toggleSelectAllOnPage}
                    aria-label="Select all on page"
                    className={cn(!allPageSelected && somePageSelected && 'opacity-70')}
                  />
                </TableHead>
                <TableHead>
                  <SortHeader label="Listing" sortKey="title" />
                </TableHead>
                {columns.seller ? <TableHead className="hidden md:table-cell">Seller</TableHead> : null}
                {columns.section ? <TableHead className="hidden 2xl:table-cell">Section</TableHead> : null}
                {columns.brand ? <TableHead className="hidden lg:table-cell">Brand / model</TableHead> : null}
                <TableHead className="text-right">
                  <SortHeader label="Price" sortKey="price" className="ml-auto" />
                </TableHead>
                <TableHead>Status</TableHead>
                {columns.views ? (
                  <TableHead className="hidden text-right sm:table-cell">
                    <SortHeader label="Views" sortKey="views" className="ml-auto" />
                  </TableHead>
                ) : null}
                {columns.date ? (
                  <TableHead className="hidden lg:table-cell">
                    <SortHeader label="Date" sortKey="created_at" />
                  </TableHead>
                ) : null}
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.map((listing) => {
                const meta = statusMeta(listing.status)
                const selected = selectedIds.has(listing.id)
                return (
                  <TableRow key={listing.id} data-state={selected ? 'selected' : undefined}>
                    <TableCell className="pl-4">
                      <Checkbox
                        checked={selected}
                        onCheckedChange={() => toggleSelect(listing.id)}
                        aria-label={`Select ${listing.title}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Link
                          href={getListingViewHref(listing.section, listing.id, listing.slug)}
                          className="group relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-muted ring-1 ring-border"
                        >
                          {listing.listing_images?.[0]?.url ? (
                            <Image
                              src={proxiedListingImageSrc(listing.listing_images[0].url) || '/placeholder.svg'}
                              alt=""
                              fill
                              sizes="40px"
                              className="object-cover object-center transition-transform duration-200 group-hover:scale-110"
                              unoptimized
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <Package className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                        </Link>
                        <div className="flex min-w-0 flex-col">
                          <div className="flex items-center gap-1.5">
                            <Link
                              href={getListingViewHref(listing.section, listing.id, listing.slug)}
                              className="line-clamp-1 max-w-[150px] font-medium text-foreground hover:underline"
                            >
                              {capitalizeWords(listing.title)}
                            </Link>
                            {listing.hidden_from_site ? (
                              <span title="Hidden from site">
                                <EyeOff className="h-3.5 w-3.5 shrink-0 text-amber-500" aria-hidden />
                              </span>
                            ) : null}
                          </div>
                          <span className="line-clamp-1 max-w-[150px] text-xs text-muted-foreground">
                            {listing.categories?.name ?? 'Uncategorized'}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    {columns.seller ? (
                      <TableCell className="hidden md:table-cell">
                        <div className="flex items-center gap-2">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-[10px] font-semibold text-foreground">
                            {sellerInitials(listing.profiles?.display_name || '?')}
                          </span>
                          <span className="line-clamp-1 max-w-[96px] text-sm text-foreground">
                            {listing.profiles?.display_name || 'Unknown'}
                          </span>
                        </div>
                      </TableCell>
                    ) : null}
                    {columns.section ? (
                      <TableCell className="hidden 2xl:table-cell">
                        <Badge variant="outline">{formatListingSectionLabel(listing.section)}</Badge>
                      </TableCell>
                    ) : null}
                    {columns.brand ? (
                      <TableCell className="hidden max-w-[120px] lg:table-cell">
                        <span className="line-clamp-1 text-sm text-foreground">
                          {listing.brand?.trim() || '—'}
                        </span>
                        <span className="line-clamp-1 text-xs text-muted-foreground">
                          {listing.model?.trim() || ''}
                        </span>
                      </TableCell>
                    ) : null}
                    <TableCell className="text-right font-semibold tabular-nums text-foreground">
                      {formatUsd(Number(listing.price) || 0)}
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium',
                          meta.badge,
                        )}
                      >
                        <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} />
                        {meta.label}
                      </span>
                    </TableCell>
                    {columns.views ? (
                      <TableCell className="hidden text-right tabular-nums text-muted-foreground sm:table-cell">
                        {compactNumber(Number(listing.views) || 0)}
                      </TableCell>
                    ) : null}
                    {columns.date ? (
                      <TableCell className="hidden whitespace-nowrap lg:table-cell">
                        <span
                          className="text-sm text-foreground"
                          title={formatDistanceToNow(new Date(listing.created_at), { addSuffix: true })}
                        >
                          {format(new Date(listing.created_at), 'MMM d, yyyy')}
                        </span>
                      </TableCell>
                    ) : null}
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
                              <Eye className="mr-2 h-4 w-4" /> View
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => editListing(listing)}>
                            <Pencil className="mr-2 h-4 w-4" /> Edit listing
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setSectionPick(normalizeListingSection(listing.section) ?? 'surfboards')
                              setCategoryPick(listing.category_id.trim())
                              setCategoryDialogListing(listing)
                            }}
                          >
                            <Layers className="mr-2 h-4 w-4" /> Change listing type
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toggleSiteVisibility(listing)}>
                            {listing.hidden_from_site ? (
                              <>
                                <Eye className="mr-2 h-4 w-4" /> Show on site
                              </>
                            ) : (
                              <>
                                <EyeOff className="mr-2 h-4 w-4" /> Hide from site
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {listing.status === 'active' ? (
                            <DropdownMenuItem onClick={() => updateListingStatus(listing.id, 'removed')}>
                              <Flag className="mr-2 h-4 w-4" /> Remove
                            </DropdownMenuItem>
                          ) : null}
                          {listing.status === 'removed' ? (
                            <DropdownMenuItem onClick={() => updateListingStatus(listing.id, 'active')}>
                              <RotateCcw className="mr-2 h-4 w-4" /> Restore
                            </DropdownMenuItem>
                          ) : null}
                          {listing.status === 'sold' ? (
                            <DropdownMenuItem
                              onClick={() => {
                                if (
                                  !confirm(
                                    'Make this listing live again? It was marked sold—only do this if the sale was reversed or was a mistake.',
                                  )
                                )
                                  return
                                updateListingStatus(listing.id, 'active')
                              }}
                            >
                              <RotateCcw className="mr-2 h-4 w-4" /> Reactivate (make live)
                            </DropdownMenuItem>
                          ) : null}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => deleteListing(listing.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}

        {/* Pagination */}
        {!loading && filtered.length > 0 ? (
          <div className="flex flex-col items-center justify-between gap-3 border-t border-border px-4 py-3 sm:flex-row">
            <p className="text-xs text-muted-foreground">
              Showing{' '}
              <span className="font-medium tabular-nums text-foreground">
                {pageStart + 1}–{Math.min(pageStart + pageSize, filtered.length)}
              </span>{' '}
              of <span className="font-medium tabular-nums text-foreground">{filtered.length}</span>
            </p>
            <div className="flex items-center gap-3">
              <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                <SelectTrigger className="h-8 w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n} per page
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={currentPage <= 1}
                  onClick={() => setPage(1)}
                  aria-label="First page"
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={currentPage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="px-2 text-xs tabular-nums text-muted-foreground">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  aria-label="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage(totalPages)}
                  aria-label="Last page"
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
