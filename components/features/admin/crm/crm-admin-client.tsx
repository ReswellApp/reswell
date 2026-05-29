"use client"

import { useCallback, useEffect, useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import {
  crmBoardInterestLabel,
  crmContactDisplayName,
  getCrmStats,
  listCrmBoardInterestsForContact,
  listCrmContacts,
  listCrmInteractionsForContact,
  listCrmStaff,
  listCrmTags,
  type CrmBoardInterestWithEmbeds,
  type CrmContactPriority,
  type CrmContactSource,
  type CrmContactStatus,
  type CrmContactWithProfile,
  type CrmInteractionWithAuthor,
  type CrmStaffMember,
  type CrmStats,
  type CrmTagRow,
} from "@/lib/db/crm"
import {
  assignCrmContactAction,
  bulkDeleteCrmContactsAction,
  bulkUpdateCrmContactsAction,
  createCrmBoardInterestAction,
  createCrmContactFromProfileAction,
  createCrmExternalContactAction,
  deleteCrmBoardInterestAction,
  deleteCrmContactAction,
  logCrmInteractionAction,
  markCrmContactedAction,
  updateCrmBoardInterestAction,
  updateCrmContactAction,
} from "@/lib/actions/crmAdmin"
import {
  CRM_INTERACTION_LABEL,
  CRM_INTEREST_STATUS_LABEL,
  CRM_PRIORITY_LABEL,
  CRM_SOURCE_LABEL,
  CRM_STATUS_LABEL,
  contactNeedsFollowUp,
  crmInterestStatusBadgeClass,
  crmPriorityBadgeClass,
  crmStatusBadgeClass,
  crmTagDotClass,
  formatCurrency,
} from "@/components/features/admin/crm/crm-labels"
import { CrmAnalytics } from "@/components/features/admin/crm/crm-analytics"
import { CrmBoardView } from "@/components/features/admin/crm/crm-board-view"
import { CrmBulkBar } from "@/components/features/admin/crm/crm-bulk-bar"
import {
  CRM_DEFAULT_FILTERS,
  CRM_SEGMENTS,
  activeSegmentId,
  type CrmFilterState,
} from "@/components/features/admin/crm/crm-segments"
import { downloadContactsCsv } from "@/components/features/admin/crm/crm-export"
import { CrmTagChips, CrmTagEditor } from "@/components/features/admin/crm/crm-tag-editor"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CalendarClock,
  Check,
  ChevronsUpDown,
  Columns3,
  Download,
  ExternalLink,
  Flame,
  LayoutGrid,
  Loader2,
  Mail,
  MessageSquarePlus,
  Phone,
  Plus,
  Search,
  Trash2,
  UserPlus,
  Users,
  Waves,
} from "lucide-react"
import { toast } from "sonner"
import { format, formatDistanceToNow } from "date-fns"
import { cn } from "@/lib/utils"

type ProfileSearchHit = {
  id: string
  display_name: string | null
  email: string | null
  avatar_url: string | null
  seller_slug: string | null
}

type ListingSearchHit = {
  id: string
  title: string | null
  brand: string | null
  model: string | null
  dimensions: string | null
  price: number | null
  slug: string | null
}

type CatalogModelHit = {
  id: string
  name: string
  brandName: string | null
}

type BrandSearchHit = {
  id: string
  name: string
  slug: string | null
  logo_url: string | null
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}

function isAbortError(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  if (err.name === "AbortError") return true
  return typeof err.message === "string" && err.message.toLowerCase().includes("aborted")
}

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  accent,
}: {
  title: string
  value: number
  description: string
  icon: typeof Users
  accent: string
}) {
  return (
    <Card className="overflow-hidden border-0 shadow-sm">
      <CardContent className="relative p-5">
        <div className={cn("absolute inset-0 opacity-[0.07]", accent)} />
        <div className="relative flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold tracking-tight">{value}</p>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
          <div className={cn("rounded-xl p-2.5", accent.replace("bg-", "bg-opacity-15 bg-"))}>
            <Icon className={cn("h-5 w-5", accent.replace("bg-", "text-").replace("-500", "-600"))} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

type CrmSortKey = "updated" | "name" | "status" | "priority" | "last_contacted" | "next_follow_up"
type CrmSortState = { key: CrmSortKey; dir: "asc" | "desc" }

const STATUS_ORDER: Record<CrmContactStatus, number> = {
  lead: 0,
  prospect: 1,
  active: 2,
  customer: 3,
  inactive: 4,
}
const PRIORITY_ORDER: Record<CrmContactPriority, number> = { low: 0, medium: 1, high: 2 }

function timeValue(value: string | null): number {
  if (!value) return 0
  const t = new Date(value).getTime()
  return Number.isFinite(t) ? t : 0
}

function sortContacts(rows: CrmContactWithProfile[], sort: CrmSortState): CrmContactWithProfile[] {
  const sorted = [...rows].sort((a, b) => {
    let cmp = 0
    switch (sort.key) {
      case "name":
        cmp = crmContactDisplayName(a).localeCompare(crmContactDisplayName(b))
        break
      case "status":
        cmp = STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
        break
      case "priority":
        cmp = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
        break
      case "last_contacted":
        cmp = timeValue(a.last_contacted_at) - timeValue(b.last_contacted_at)
        break
      case "next_follow_up":
        cmp = timeValue(a.next_follow_up_at) - timeValue(b.next_follow_up_at)
        break
      default:
        cmp = timeValue(a.updated_at) - timeValue(b.updated_at)
    }
    return sort.dir === "asc" ? cmp : -cmp
  })
  return sorted
}

function SortHeader({
  label,
  columnKey,
  sort,
  onSort,
  className,
}: {
  label: string
  columnKey: CrmSortKey
  sort: CrmSortState
  onSort: (key: CrmSortKey) => void
  className?: string
}) {
  const active = sort.key === columnKey
  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => onSort(columnKey)}
        className="inline-flex items-center gap-1 font-medium transition-colors hover:text-foreground"
      >
        {label}
        {active ? (
          sort.dir === "asc" ? (
            <ArrowUp className="h-3.5 w-3.5" />
          ) : (
            <ArrowDown className="h-3.5 w-3.5" />
          )
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
        )}
      </button>
    </TableHead>
  )
}

export function CrmAdminClient() {
  const supabase = useMemo(() => createClient(), [])
  const [loading, setLoading] = useState(true)
  const [contacts, setContacts] = useState<CrmContactWithProfile[]>([])
  const [stats, setStats] = useState<CrmStats | null>(null)
  const [staff, setStaff] = useState<CrmStaffMember[]>([])
  const [tags, setTags] = useState<CrmTagRow[]>([])
  const [search, setSearch] = useState("")
  const [filters, setFilters] = useState<CrmFilterState>(CRM_DEFAULT_FILTERS)
  const [view, setView] = useState<"table" | "board">("table")
  const [sort, setSort] = useState<CrmSortState>({ key: "updated", dir: "desc" })
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null)
  const [addContactOpen, setAddContactOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const selectedContact = useMemo(
    () => contacts.find((c) => c.id === selectedContactId) ?? null,
    [contacts, selectedContactId],
  )

  useEffect(() => {
    const saved = window.localStorage.getItem("crm:view")
    if (saved === "board" || saved === "table") setView(saved)
  }, [])

  const changeView = useCallback((next: "table" | "board") => {
    setView(next)
    window.localStorage.setItem("crm:view", next)
  }, [])

  const updateFilter = useCallback((patch: Partial<CrmFilterState>) => {
    setFilters((prev) => ({ ...prev, ...patch }))
  }, [])

  const loadContacts = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true)
      try {
        const [rows, statRows] = await Promise.all([
          listCrmContacts(supabase, {
            search,
            status: filters.status,
            priority: filters.priority,
            source: filters.source,
            assignedTo: filters.assignedTo,
          }),
          getCrmStats(supabase),
        ])
        setContacts(rows)
        setStats(statRows)
      } catch (err) {
        if (isAbortError(err)) return
        console.error("CrmAdminClient.loadContacts:", err)
      } finally {
        if (!opts?.silent) setLoading(false)
      }
    },
    [supabase, search, filters.status, filters.priority, filters.source, filters.assignedTo],
  )

  useEffect(() => {
    void loadContacts()
  }, [loadContacts])

  const loadMeta = useCallback(async () => {
    try {
      const [staffRows, tagRows] = await Promise.all([listCrmStaff(supabase), listCrmTags(supabase)])
      setStaff(staffRows)
      setTags(tagRows)
    } catch (err) {
      if (isAbortError(err)) return
      console.error("CrmAdminClient.loadMeta:", err)
    }
  }, [supabase])

  useEffect(() => {
    void loadMeta()
  }, [loadMeta])

  const filteredContacts = useMemo(() => {
    let rows = contacts
    if (filters.followUpOnly) rows = rows.filter((c) => contactNeedsFollowUp(c))
    if (filters.createdWithinDays != null) {
      const cutoff = Date.now() - filters.createdWithinDays * 86_400_000
      rows = rows.filter((c) => timeValue(c.created_at) >= cutoff)
    }
    if (filters.tagId != null) {
      rows = rows.filter((c) => c.tags.some((t) => t.id === filters.tagId))
    }
    return sortContacts(rows, sort)
  }, [contacts, filters.followUpOnly, filters.createdWithinDays, filters.tagId, sort])

  const visibleIds = useMemo(() => filteredContacts.map((c) => c.id), [filteredContacts])
  const selectedVisibleCount = useMemo(
    () => visibleIds.filter((id) => selectedIds.has(id)).length,
    [visibleIds, selectedIds],
  )
  const allVisibleSelected = visibleIds.length > 0 && selectedVisibleCount === visibleIds.length

  const clearSelection = useCallback(() => setSelectedIds(new Set()), [])

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (visibleIds.every((id) => next.has(id))) {
        visibleIds.forEach((id) => next.delete(id))
      } else {
        visibleIds.forEach((id) => next.add(id))
      }
      return next
    })
  }, [visibleIds])

  const toggleSelectOne = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleSort = useCallback((key: CrmSortKey) => {
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }))
  }, [])

  const refreshAfterMutation = useCallback(() => {
    startTransition(() => {
      void loadContacts()
    })
  }, [loadContacts])

  const moveContacts = useCallback(
    async (contactIds: string[], status: CrmContactStatus) => {
      if (contactIds.length === 0) return
      const idSet = new Set(contactIds)
      setContacts((prev) => prev.map((c) => (idSet.has(c.id) ? { ...c, status } : c)))
      if (contactIds.length > 1) clearSelection()
      try {
        const result =
          contactIds.length === 1
            ? await updateCrmContactAction({ contactId: contactIds[0], status })
            : await bulkUpdateCrmContactsAction({ contactIds, status })
        if ("error" in result) {
          toast.error(result.error)
          void loadContacts({ silent: true })
          return
        }
        void loadContacts({ silent: true })
      } catch (err) {
        if (isAbortError(err)) return
        console.error("CrmAdminClient.moveContacts:", err)
        toast.error("Could not move contact")
        void loadContacts({ silent: true })
      }
    },
    [loadContacts, clearSelection],
  )

  const runBulkUpdate = useCallback(
    async (patch: { status?: CrmContactStatus; priority?: CrmContactPriority; markContacted?: boolean }) => {
      const ids = Array.from(selectedIds)
      if (ids.length === 0) return
      setBulkBusy(true)
      try {
        const result = await bulkUpdateCrmContactsAction({ contactIds: ids, ...patch })
        if ("error" in result) {
          toast.error(result.error)
          return
        }
        toast.success(`${ids.length} contact${ids.length === 1 ? "" : "s"} updated`)
        clearSelection()
        await loadContacts({ silent: true })
      } catch (err) {
        if (isAbortError(err)) return
        console.error("CrmAdminClient.runBulkUpdate:", err)
        toast.error("Bulk update failed")
      } finally {
        setBulkBusy(false)
      }
    },
    [selectedIds, clearSelection, loadContacts],
  )

  const handleBulkDelete = useCallback(async () => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    setBulkBusy(true)
    try {
      const result = await bulkDeleteCrmContactsAction({ contactIds: ids })
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      toast.success(`${ids.length} contact${ids.length === 1 ? "" : "s"} deleted`)
      clearSelection()
      setBulkDeleteOpen(false)
      await loadContacts({ silent: true })
    } catch (err) {
      if (isAbortError(err)) return
      console.error("CrmAdminClient.handleBulkDelete:", err)
      toast.error("Bulk delete failed")
    } finally {
      setBulkBusy(false)
    }
  }, [selectedIds, clearSelection, loadContacts])

  const currentSegment = activeSegmentId(filters)
  const hasContacts = contacts.length > 0

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">CRM</h1>
          <p className="text-muted-foreground max-w-2xl">
            Track surfboard shoppers, log touchpoints, and manage board interests — from Reswell profiles or
            external leads.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ToggleGroup
            type="single"
            value={view}
            onValueChange={(v) => {
              if (v === "table" || v === "board") changeView(v)
            }}
            variant="outline"
            size="sm"
            className="gap-0 rounded-md border"
          >
            <ToggleGroupItem value="table" aria-label="Table view" className="rounded-r-none border-0">
              <LayoutGrid className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="board" aria-label="Board view" className="rounded-l-none border-0">
              <Columns3 className="h-4 w-4" />
            </ToggleGroupItem>
          </ToggleGroup>
          <Button
            variant="outline"
            onClick={() => downloadContactsCsv(filteredContacts)}
            disabled={filteredContacts.length === 0}
          >
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button onClick={() => setAddContactOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Add contact
          </Button>
        </div>
      </div>

      {stats ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Total contacts"
            value={stats.totalContacts}
            description="Profiles and external leads"
            icon={Users}
            accent="bg-sky-500"
          />
          <StatCard
            title="Needs follow-up"
            value={stats.needsFollowUp}
            description="Overdue or never contacted"
            icon={CalendarClock}
            accent="bg-amber-500"
          />
          <StatCard
            title="High priority"
            value={stats.highPriority}
            description="Hot leads in pipeline"
            icon={Flame}
            accent="bg-rose-500"
          />
          <StatCard
            title="Active board interests"
            value={stats.activeInterests}
            description="Interested, contacted, or matched"
            icon={Waves}
            accent="bg-teal-500"
          />
        </div>
      ) : null}

      {stats ? <CrmAnalytics stats={stats} /> : null}

      <div className="flex flex-wrap items-center gap-2">
        {CRM_SEGMENTS.map((segment) => {
          const Icon = segment.icon
          const active = currentSegment === segment.id
          return (
            <button
              key={segment.id}
              type="button"
              onClick={() => {
                setFilters(segment.filters)
                clearSelection()
              }}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "border-teal-500 bg-teal-500 text-white shadow-sm"
                  : "border-border bg-background text-muted-foreground hover:bg-muted",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {segment.label}
            </button>
          )
        })}
      </div>

      <Card className="border shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Pipeline</CardTitle>
          <CardDescription>Search and filter your contact list</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, email, or phone…"
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Select
                value={filters.status}
                onValueChange={(v) => updateFilter({ status: v as CrmContactStatus | "all" })}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {(Object.keys(CRM_STATUS_LABEL) as CrmContactStatus[]).map((s) => (
                    <SelectItem key={s} value={s}>
                      {CRM_STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={filters.priority}
                onValueChange={(v) => updateFilter({ priority: v as CrmContactPriority | "all" })}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All priorities</SelectItem>
                  {(Object.keys(CRM_PRIORITY_LABEL) as CrmContactPriority[]).map((p) => (
                    <SelectItem key={p} value={p}>
                      {CRM_PRIORITY_LABEL[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={filters.source}
                onValueChange={(v) => updateFilter({ source: v as CrmContactSource | "all" })}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sources</SelectItem>
                  {(Object.keys(CRM_SOURCE_LABEL) as CrmContactSource[]).map((s) => (
                    <SelectItem key={s} value={s}>
                      {CRM_SOURCE_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={filters.assignedTo}
                onValueChange={(v) => updateFilter({ assignedTo: v as CrmFilterState["assignedTo"] })}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Owner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All owners</SelectItem>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {staff.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.display_name ?? "Staff"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {tags.length > 0 ? (
                <Select
                  value={filters.tagId ?? "all"}
                  onValueChange={(v) => updateFilter({ tagId: v === "all" ? null : v })}
                >
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Tag" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All tags</SelectItem>
                    {tags.map((tag) => (
                      <SelectItem key={tag.id} value={tag.id}>
                        <span className="inline-flex items-center gap-2">
                          <span className={cn("h-2 w-2 rounded-full", crmTagDotClass(tag.color))} />
                          {tag.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}
              <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                <Switch
                  id="follow-up-only"
                  checked={filters.followUpOnly}
                  onCheckedChange={(checked) => updateFilter({ followUpOnly: checked })}
                />
                <Label htmlFor="follow-up-only" className="text-sm font-normal whitespace-nowrap cursor-pointer">
                  Follow-up due
                </Label>
              </div>
            </div>
          </div>

          {selectedIds.size > 0 ? (
            <CrmBulkBar
              count={selectedIds.size}
              isPending={bulkBusy}
              onClear={clearSelection}
              onSetStatus={(status) => void runBulkUpdate({ status })}
              onSetPriority={(priority) => void runBulkUpdate({ priority })}
              onMarkContacted={() => void runBulkUpdate({ markContacted: true })}
              onDelete={() => setBulkDeleteOpen(true)}
            />
          ) : null}

          {loading ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-sm">Loading contacts…</p>
            </div>
          ) : !hasContacts ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-16 text-center">
              <Users className="h-10 w-10 text-muted-foreground/60" />
              <div>
                <p className="font-medium">No contacts yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Add a Reswell profile or external lead to start tracking board interests.
                </p>
              </div>
              <Button variant="outline" onClick={() => setAddContactOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add your first contact
              </Button>
            </div>
          ) : view === "board" ? (
            <CrmBoardView
              contacts={filteredContacts}
              selectedIds={selectedIds}
              onMove={moveContacts}
              onSelect={setSelectedContactId}
              onToggleSelect={toggleSelectOne}
            />
          ) : filteredContacts.length === 0 ? (
            <div className="rounded-lg border border-dashed py-16 text-center text-sm text-muted-foreground">
              No contacts match your filters.
            </div>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="w-10">
                      <Checkbox
                        checked={allVisibleSelected}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Select all"
                      />
                    </TableHead>
                    <SortHeader label="Contact" columnKey="name" sort={sort} onSort={handleSort} />
                    <TableHead>Source</TableHead>
                    <SortHeader label="Status" columnKey="status" sort={sort} onSort={handleSort} />
                    <SortHeader label="Priority" columnKey="priority" sort={sort} onSort={handleSort} />
                    <TableHead>Owner</TableHead>
                    <SortHeader
                      label="Last contacted"
                      columnKey="last_contacted"
                      sort={sort}
                      onSort={handleSort}
                    />
                    <SortHeader
                      label="Next follow-up"
                      columnKey="next_follow_up"
                      sort={sort}
                      onSort={handleSort}
                    />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredContacts.map((contact) => {
                    const name = crmContactDisplayName(contact)
                    const avatarUrl = contact.profile?.avatar_url
                    const needsFollowUp = contactNeedsFollowUp(contact)
                    const isSelected = selectedIds.has(contact.id)
                    return (
                      <TableRow
                        key={contact.id}
                        data-state={isSelected ? "selected" : undefined}
                        className="cursor-pointer"
                        onClick={() => setSelectedContactId(contact.id)}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelectOne(contact.id)}
                            aria-label={`Select ${name}`}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9">
                              {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
                              <AvatarFallback className="text-xs">{initials(name)}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="font-medium truncate">{name}</p>
                              <p className="text-xs text-muted-foreground truncate">
                                {contact.email ?? contact.profile?.email ?? "No email"}
                              </p>
                              {contact.tags.length > 0 ? (
                                <CrmTagChips tags={contact.tags} max={3} className="mt-1" />
                              ) : null}
                            </div>
                            {needsFollowUp ? (
                              <Badge variant="outline" className="ml-auto shrink-0 border-amber-300 text-amber-700">
                                Due
                              </Badge>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{CRM_SOURCE_LABEL[contact.source]}</Badge>
                        </TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
                              crmStatusBadgeClass(contact.status),
                            )}
                          >
                            {CRM_STATUS_LABEL[contact.status]}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
                              crmPriorityBadgeClass(contact.priority),
                            )}
                          >
                            {CRM_PRIORITY_LABEL[contact.priority]}
                          </span>
                        </TableCell>
                        <TableCell>
                          {contact.assignee ? (
                            <span className="flex items-center gap-2">
                              <Avatar className="h-6 w-6">
                                {contact.assignee.avatar_url ? (
                                  <AvatarImage src={contact.assignee.avatar_url} alt="" />
                                ) : null}
                                <AvatarFallback className="text-[9px]">
                                  {initials(contact.assignee.display_name ?? "?")}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-xs text-muted-foreground truncate max-w-[100px]">
                                {contact.assignee.display_name ?? "Staff"}
                              </span>
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {contact.last_contacted_at
                            ? formatDistanceToNow(new Date(contact.last_contacted_at), { addSuffix: true })
                            : "Never"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {contact.next_follow_up_at
                            ? format(new Date(contact.next_follow_up_at), "MMM d, yyyy")
                            : "—"}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AddContactDialog
        open={addContactOpen}
        onOpenChange={setAddContactOpen}
        supabase={supabase}
        onSuccess={() => {
          setAddContactOpen(false)
          refreshAfterMutation()
        }}
        isPending={isPending}
      />

      <ContactDetailSheet
        contact={selectedContact}
        open={selectedContactId != null}
        onOpenChange={(open) => {
          if (!open) setSelectedContactId(null)
        }}
        supabase={supabase}
        staff={staff}
        allTags={tags}
        onTagsChanged={() => void loadMeta()}
        onMutated={refreshAfterMutation}
        isPending={isPending}
      />

      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.size} contact{selectedIds.size === 1 ? "" : "s"}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the selected contacts and all their board interests and activity history. This cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault()
                void handleBulkDelete()
              }}
              disabled={bulkBusy}
            >
              {bulkBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function AddContactDialog({
  open,
  onOpenChange,
  supabase,
  onSuccess,
  isPending,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  supabase: ReturnType<typeof createClient>
  onSuccess: () => void
  isPending: boolean
}) {
  const [tab, setTab] = useState<"profile" | "external">("profile")
  const [profileQuery, setProfileQuery] = useState("")
  const [profileHits, setProfileHits] = useState<ProfileSearchHit[]>([])
  const [profileLoading, setProfileLoading] = useState(false)
  const [selectedProfile, setSelectedProfile] = useState<ProfileSearchHit | null>(null)
  const [profilePopoverOpen, setProfilePopoverOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [notes, setNotes] = useState("")

  useEffect(() => {
    if (!open) {
      setTab("profile")
      setSelectedProfile(null)
      setProfileQuery("")
      setFirstName("")
      setLastName("")
      setEmail("")
      setPhone("")
      setNotes("")
    }
  }, [open])

  useEffect(() => {
    if (tab !== "profile" || profileQuery.trim().length < 2) {
      setProfileHits([])
      return
    }
    let cancelled = false
    setProfileLoading(true)
    const q = profileQuery.trim().replace(/[%_]/g, "")
    void supabase
      .from("profiles")
      .select("id, display_name, email, avatar_url, seller_slug")
      .or(`display_name.ilike.%${q}%,email.ilike.%${q}%`)
      .order("display_name")
      .limit(15)
      .then(({ data }) => {
        if (cancelled) return
        setProfileHits((data ?? []) as ProfileSearchHit[])
        setProfileLoading(false)
      })
      .catch((err) => {
        if (cancelled || isAbortError(err)) return
        console.error("AddContactDialog profile search:", err)
        setProfileHits([])
        setProfileLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [profileQuery, supabase, tab])

  async function handleSubmit() {
    setSubmitting(true)
    try {
      if (tab === "profile") {
        if (!selectedProfile) {
          toast.error("Select a Reswell profile")
          return
        }
        const result = await createCrmContactFromProfileAction({ profileId: selectedProfile.id })
        if ("error" in result) {
          toast.error(result.error)
          return
        }
        toast.success("Profile added to CRM")
      } else {
        const result = await createCrmExternalContactAction({
          firstName,
          lastName: lastName || undefined,
          email: email || undefined,
          phone: phone || undefined,
          notes: notes || undefined,
        })
        if ("error" in result) {
          toast.error(result.error)
          return
        }
        toast.success("External contact added")
      }
      onSuccess()
    } catch (err) {
      if (isAbortError(err)) return
      console.error("AddContactDialog.handleSubmit:", err)
      toast.error("Could not save contact")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add contact</DialogTitle>
          <DialogDescription>
            Import an existing Reswell user or create an external lead.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "profile" | "external")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="profile">From profile</TabsTrigger>
            <TabsTrigger value="external">External lead</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-4 pt-2">
            <Popover open={profilePopoverOpen} onOpenChange={setProfilePopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                  {selectedProfile ? (
                    <span className="truncate">{selectedProfile.display_name ?? selectedProfile.email}</span>
                  ) : (
                    <span className="text-muted-foreground">Search profiles…</span>
                  )}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="Name or email…"
                    value={profileQuery}
                    onValueChange={setProfileQuery}
                  />
                  <CommandList>
                    <CommandEmpty>
                      {profileLoading ? "Searching…" : profileQuery.length < 2 ? "Type to search" : "No profiles found"}
                    </CommandEmpty>
                    <CommandGroup>
                      {profileHits.map((hit) => (
                        <CommandItem
                          key={hit.id}
                          value={hit.id}
                          onSelect={() => {
                            setSelectedProfile(hit)
                            setProfilePopoverOpen(false)
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedProfile?.id === hit.id ? "opacity-100" : "opacity-0",
                            )}
                          />
                          <div className="min-w-0">
                            <p className="truncate">{hit.display_name ?? "Unnamed"}</p>
                            <p className="text-xs text-muted-foreground truncate">{hit.email}</p>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </TabsContent>

          <TabsContent value="external" className="space-y-4 pt-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="crm-first-name">First name</Label>
                <Input id="crm-first-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="crm-last-name">Last name</Label>
                <Input id="crm-last-name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="crm-email">Email</Label>
              <Input id="crm-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="crm-phone">Phone</Label>
              <Input id="crm-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="crm-notes">Notes</Label>
              <Textarea id="crm-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={submitting || isPending}>
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Add contact
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ContactDetailSheet({
  contact,
  open,
  onOpenChange,
  supabase,
  staff,
  allTags,
  onTagsChanged,
  onMutated,
  isPending,
}: {
  contact: CrmContactWithProfile | null
  open: boolean
  onOpenChange: (open: boolean) => void
  supabase: ReturnType<typeof createClient>
  staff: CrmStaffMember[]
  allTags: CrmTagRow[]
  onTagsChanged: () => void
  onMutated: () => void
  isPending: boolean
}) {
  const [interests, setInterests] = useState<CrmBoardInterestWithEmbeds[]>([])
  const [interactions, setInteractions] = useState<CrmInteractionWithAuthor[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [addInterestOpen, setAddInterestOpen] = useState(false)
  const [logInteractionOpen, setLogInteractionOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [assigning, setAssigning] = useState(false)

  const [editStatus, setEditStatus] = useState<CrmContactStatus>("lead")
  const [editPriority, setEditPriority] = useState<CrmContactPriority>("medium")
  const [editNotes, setEditNotes] = useState("")
  const [editNextFollowUp, setEditNextFollowUp] = useState("")

  const loadDetail = useCallback(async () => {
    if (!contact) return
    setDetailLoading(true)
    try {
      const [interestRows, interactionRows] = await Promise.all([
        listCrmBoardInterestsForContact(supabase, contact.id),
        listCrmInteractionsForContact(supabase, contact.id),
      ])
      setInterests(interestRows)
      setInteractions(interactionRows)
    } catch (err) {
      if (isAbortError(err)) return
      console.error("ContactDetailSheet.loadDetail:", err)
    } finally {
      setDetailLoading(false)
    }
  }, [contact, supabase])

  useEffect(() => {
    if (contact && open) {
      setEditStatus(contact.status)
      setEditPriority(contact.priority)
      setEditNotes(contact.notes ?? "")
      setEditNextFollowUp(contact.next_follow_up_at ? contact.next_follow_up_at.slice(0, 16) : "")
      void loadDetail()
    }
  }, [contact, open, loadDetail])

  if (!contact) return null

  const name = crmContactDisplayName(contact)
  const avatarUrl = contact.profile?.avatar_url

  async function saveContactFields() {
    setSaving(true)
    try {
      const result = await updateCrmContactAction({
        contactId: contact!.id,
        status: editStatus,
        priority: editPriority,
        notes: editNotes || null,
        nextFollowUpAt: editNextFollowUp ? new Date(editNextFollowUp).toISOString() : null,
      })
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      toast.success("Contact updated")
      onMutated()
    } catch (err) {
      if (isAbortError(err)) return
      console.error("ContactDetailSheet.saveContactFields:", err)
      toast.error("Could not save contact")
    } finally {
      setSaving(false)
    }
  }

  async function handleMarkContacted() {
    try {
      const result = await markCrmContactedAction({
        contactId: contact!.id,
        nextFollowUpAt: editNextFollowUp ? new Date(editNextFollowUp).toISOString() : null,
      })
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      toast.success("Marked as contacted")
      onMutated()
      void loadDetail()
    } catch (err) {
      if (isAbortError(err)) return
      console.error("ContactDetailSheet.handleMarkContacted:", err)
      toast.error("Could not mark contacted")
    }
  }

  async function handleDelete() {
    try {
      const result = await deleteCrmContactAction({ contactId: contact!.id })
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      toast.success("Contact deleted")
      onOpenChange(false)
      onMutated()
    } catch (err) {
      if (isAbortError(err)) return
      console.error("ContactDetailSheet.handleDelete:", err)
      toast.error("Could not delete contact")
    }
  }

  async function handleAssign(value: string) {
    setAssigning(true)
    try {
      const result = await assignCrmContactAction({
        contactId: contact!.id,
        assignedTo: value === "unassigned" ? null : value,
      })
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      toast.success("Owner updated")
      onMutated()
    } catch (err) {
      if (isAbortError(err)) return
      console.error("ContactDetailSheet.handleAssign:", err)
      toast.error("Could not assign owner")
    } finally {
      setAssigning(false)
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader className="space-y-4 pb-4">
            <div className="flex items-start gap-4">
              <Avatar className="h-14 w-14">
                {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
                <AvatarFallback>{initials(name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1 space-y-1">
                <SheetTitle className="text-xl">{name}</SheetTitle>
                <SheetDescription className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{CRM_SOURCE_LABEL[contact.source]}</Badge>
                  {contact.profile?.seller_slug ? (
                    <Link
                      href={`/sellers/${contact.profile.seller_slug}`}
                      target="_blank"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      View profile
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  ) : null}
                  {contact.profile_id ? (
                    <Link
                      href={`/admin/users/${contact.profile_id}`}
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      Admin user
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  ) : null}
                </SheetDescription>
                <div className="flex flex-wrap gap-3 text-sm text-muted-foreground pt-1">
                  {contact.email ? (
                    <span className="inline-flex items-center gap-1">
                      <Mail className="h-3.5 w-3.5" />
                      {contact.email}
                    </span>
                  ) : null}
                  {contact.phone ? (
                    <span className="inline-flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5" />
                      {contact.phone}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setLogInteractionOpen(true)}>
                <MessageSquarePlus className="mr-2 h-4 w-4" />
                Log touchpoint
              </Button>
              <Button size="sm" variant="secondary" onClick={() => void handleMarkContacted()}>
                Mark contacted now
              </Button>
              <Button size="sm" onClick={() => setAddInterestOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add board interest
              </Button>
            </div>
          </SheetHeader>

          <Tabs defaultValue="overview" className="mt-2">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="boards">Boards ({interests.length})</TabsTrigger>
              <TabsTrigger value="activity">Activity ({interactions.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4 pt-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={editStatus} onValueChange={(v) => setEditStatus(v as CrmContactStatus)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(CRM_STATUS_LABEL) as CrmContactStatus[]).map((s) => (
                        <SelectItem key={s} value={s}>
                          {CRM_STATUS_LABEL[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select value={editPriority} onValueChange={(v) => setEditPriority(v as CrmContactPriority)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(CRM_PRIORITY_LABEL) as CrmContactPriority[]).map((p) => (
                        <SelectItem key={p} value={p}>
                          {CRM_PRIORITY_LABEL[p]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="next-follow-up">Next follow-up</Label>
                  <Input
                    id="next-follow-up"
                    type="datetime-local"
                    value={editNextFollowUp}
                    onChange={(e) => setEditNextFollowUp(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Owner</Label>
                  <Select
                    value={contact.assigned_to ?? "unassigned"}
                    onValueChange={(v) => void handleAssign(v)}
                    disabled={assigning}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Unassigned" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {staff.map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          {member.display_name ?? "Staff"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Tags</Label>
                <CrmTagEditor
                  contactId={contact.id}
                  allTags={allTags}
                  contactTags={contact.tags}
                  onMutated={onMutated}
                  onTagsChanged={onTagsChanged}
                />
              </div>

              <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
                <p>
                  <span className="text-muted-foreground">Last contacted: </span>
                  {contact.last_contacted_at
                    ? format(new Date(contact.last_contacted_at), "MMM d, yyyy h:mm a")
                    : "Never"}
                </p>
                <p>
                  <span className="text-muted-foreground">Added: </span>
                  {format(new Date(contact.created_at), "MMM d, yyyy")}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact-notes">Notes</Label>
                <Textarea
                  id="contact-notes"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  rows={4}
                  placeholder="Preferences, context, conversation summary…"
                />
              </div>

              <div className="flex gap-2">
                <Button onClick={() => void saveContactFields()} disabled={saving || isPending}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Save changes
                </Button>
                <Button variant="ghost" className="text-destructive" onClick={() => setDeleteOpen(true)}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="boards" className="pt-4 space-y-3">
              {detailLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : interests.length === 0 ? (
                <div className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
                  No board interests tracked yet.
                </div>
              ) : (
                interests.map((interest) => (
                  <BoardInterestCard
                    key={interest.id}
                    interest={interest}
                    onUpdated={() => {
                      onMutated()
                      void loadDetail()
                    }}
                  />
                ))
              )}
            </TabsContent>

            <TabsContent value="activity" className="pt-4 space-y-3">
              {detailLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : interactions.length === 0 ? (
                <div className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
                  No touchpoints logged yet.
                </div>
              ) : (
                interactions.map((item, idx) => (
                  <div key={item.id}>
                    <div className="flex gap-3">
                      <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                        {(item.author?.display_name ?? "?").slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-sm">
                            {CRM_INTERACTION_LABEL[item.interaction_type]}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                          </span>
                        </div>
                        {item.subject ? <p className="text-sm font-medium">{item.subject}</p> : null}
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{item.notes}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.author?.display_name ?? "Staff"} · {format(new Date(item.created_at), "MMM d, h:mm a")}
                        </p>
                      </div>
                    </div>
                    {idx < interactions.length - 1 ? <Separator className="my-4" /> : null}
                  </div>
                ))
              )}
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>

      <AddBoardInterestDialog
        open={addInterestOpen}
        onOpenChange={setAddInterestOpen}
        contactId={contact.id}
        supabase={supabase}
        onSuccess={() => {
          setAddInterestOpen(false)
          onMutated()
          void loadDetail()
        }}
      />

      <LogInteractionDialog
        open={logInteractionOpen}
        onOpenChange={setLogInteractionOpen}
        contactId={contact.id}
        onSuccess={() => {
          setLogInteractionOpen(false)
          onMutated()
          void loadDetail()
        }}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete contact?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes {name} and all board interests and activity history from the CRM. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void handleDelete()}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function BoardInterestCard({
  interest,
  onUpdated,
}: {
  interest: CrmBoardInterestWithEmbeds
  onUpdated: () => void
}) {
  const [status, setStatus] = useState(interest.status)
  const [saving, setSaving] = useState(false)
  const label = crmBoardInterestLabel(interest)

  async function handleStatusChange(next: typeof status) {
    setStatus(next)
    setSaving(true)
    try {
      const result = await updateCrmBoardInterestAction({ interestId: interest.id, status: next })
      if ("error" in result) {
        toast.error(result.error)
        setStatus(interest.status)
        return
      }
      toast.success("Interest updated")
      onUpdated()
    } catch (err) {
      if (isAbortError(err)) {
        setStatus(interest.status)
        return
      }
      console.error("BoardInterestCard.handleStatusChange:", err)
      toast.error("Could not update interest")
      setStatus(interest.status)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    try {
      const result = await deleteCrmBoardInterestAction({ interestId: interest.id })
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      toast.success("Interest removed")
      onUpdated()
    } catch (err) {
      if (isAbortError(err)) return
      console.error("BoardInterestCard.handleDelete:", err)
      toast.error("Could not remove interest")
    }
  }

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <Waves className="h-4 w-4 text-teal-600 shrink-0" />
              <p className="font-medium truncate">{label}</p>
            </div>
            {interest.dimensions ? (
              <p className="text-xs text-muted-foreground">Dims: {interest.dimensions}</p>
            ) : null}
            {(interest.budget_min != null || interest.budget_max != null) && (
              <p className="text-xs text-muted-foreground">
                Budget: {formatCurrency(interest.budget_min)} – {formatCurrency(interest.budget_max)}
              </p>
            )}
            {interest.listing?.slug ? (
              <Link
                href={`/boards/${interest.listing.slug}`}
                target="_blank"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                View listing · {formatCurrency(interest.listing.price)}
                <ExternalLink className="h-3 w-3" />
              </Link>
            ) : null}
            {interest.interest_type === "catalog_brand" && interest.brand_catalog?.slug ? (
              <Link
                href={`/brands/${interest.brand_catalog.slug}`}
                target="_blank"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                View brand
                <ExternalLink className="h-3 w-3" />
              </Link>
            ) : null}
          </div>
          <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground" onClick={() => void handleDelete()}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
        <Select value={status} onValueChange={(v) => void handleStatusChange(v as typeof status)} disabled={saving}>
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(CRM_INTEREST_STATUS_LABEL) as typeof status[]).map((s) => (
              <SelectItem key={s} value={s}>
                <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-xs", crmInterestStatusBadgeClass(s))}>
                  {CRM_INTEREST_STATUS_LABEL[s]}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {interest.notes ? <p className="text-sm text-muted-foreground">{interest.notes}</p> : null}
      </CardContent>
    </Card>
  )
}

function AddBoardInterestDialog({
  open,
  onOpenChange,
  contactId,
  supabase,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  contactId: string
  supabase: ReturnType<typeof createClient>
  onSuccess: () => void
}) {
  const [interestType, setInterestType] = useState<
    "listing" | "catalog_model" | "catalog_brand" | "custom"
  >("custom")
  const [listingQuery, setListingQuery] = useState("")
  const [listingHits, setListingHits] = useState<ListingSearchHit[]>([])
  const [selectedListing, setSelectedListing] = useState<ListingSearchHit | null>(null)
  const [listingPopoverOpen, setListingPopoverOpen] = useState(false)

  const [modelQuery, setModelQuery] = useState("")
  const [modelHits, setModelHits] = useState<CatalogModelHit[]>([])
  const [selectedModel, setSelectedModel] = useState<CatalogModelHit | null>(null)
  const [modelPopoverOpen, setModelPopoverOpen] = useState(false)

  const [brandQuery, setBrandQuery] = useState("")
  const [brandHits, setBrandHits] = useState<BrandSearchHit[]>([])
  const [selectedBrandHit, setSelectedBrandHit] = useState<BrandSearchHit | null>(null)
  const [brandPopoverOpen, setBrandPopoverOpen] = useState(false)

  const [customDescription, setCustomDescription] = useState("")
  const [brand, setBrand] = useState("")
  const [model, setModel] = useState("")
  const [dimensions, setDimensions] = useState("")
  const [budgetMin, setBudgetMin] = useState("")
  const [budgetMax, setBudgetMax] = useState("")
  const [notes, setNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) {
      setInterestType("custom")
      setSelectedListing(null)
      setSelectedModel(null)
      setSelectedBrandHit(null)
      setBrandQuery("")
      setCustomDescription("")
      setBrand("")
      setModel("")
      setDimensions("")
      setBudgetMin("")
      setBudgetMax("")
      setNotes("")
    }
  }, [open])

  useEffect(() => {
    if (interestType !== "listing" || listingQuery.trim().length < 2) {
      setListingHits([])
      return
    }
    let cancelled = false
    const q = listingQuery.trim().replace(/[%_]/g, "")
    void supabase
      .from("listings")
      .select("id, title, brand, model, dimensions, price, slug")
      .eq("section", "surfboards")
      .or(`brand.ilike.%${q}%,model.ilike.%${q}%,title.ilike.%${q}%`)
      .order("created_at", { ascending: false })
      .limit(15)
      .then(({ data }) => {
        if (!cancelled) setListingHits((data ?? []) as ListingSearchHit[])
      })
      .catch((err) => {
        if (cancelled || isAbortError(err)) return
        console.error("AddBoardInterestDialog listing search:", err)
        setListingHits([])
      })
    return () => {
      cancelled = true
    }
  }, [interestType, listingQuery, supabase])

  useEffect(() => {
    if (interestType !== "catalog_model" || modelQuery.trim().length < 2) {
      setModelHits([])
      return
    }
    let cancelled = false
    const q = modelQuery.trim().replace(/[%_]/g, "")
    void supabase
      .from("brand_models")
      .select("id, name, brands (name)")
      .ilike("name", `%${q}%`)
      .limit(15)
      .then(({ data }) => {
        if (cancelled) return
        setModelHits(
          (data ?? []).map((row) => {
            const r = row as { id: string; name: string; brands: unknown }
            let brandName: string | null = null
            if (r.brands && typeof r.brands === "object" && !Array.isArray(r.brands)) {
              brandName = String((r.brands as { name?: string }).name ?? "") || null
            }
            return { id: r.id, name: r.name, brandName }
          }),
        )
      })
      .catch((err) => {
        if (cancelled || isAbortError(err)) return
        console.error("AddBoardInterestDialog catalog search:", err)
        setModelHits([])
      })
    return () => {
      cancelled = true
    }
  }, [interestType, modelQuery, supabase])

  useEffect(() => {
    if (interestType !== "catalog_brand") {
      setBrandHits([])
      return
    }
    let cancelled = false
    const q = brandQuery.trim().replace(/[%_]/g, "")
    const run = async () => {
      try {
        let request = supabase.from("brands").select("id, name, slug, logo_url").order("name").limit(20)
        if (q.length >= 1) request = request.ilike("name", `%${q}%`)
        const { data } = await request
        if (!cancelled) setBrandHits((data ?? []) as BrandSearchHit[])
      } catch (err) {
        if (cancelled || isAbortError(err)) return
        console.error("AddBoardInterestDialog brand search:", err)
        setBrandHits([])
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [interestType, brandQuery, supabase])

  async function handleSubmit() {
    setSubmitting(true)
    try {
      const result = await createCrmBoardInterestAction({
        contactId,
        interestType,
        listingId: selectedListing?.id,
        brandModelId: selectedModel?.id,
        brandId: selectedBrandHit?.id,
        customDescription: customDescription || undefined,
        brand: brand || undefined,
        model: model || undefined,
        dimensions: dimensions || undefined,
        budgetMin: budgetMin ? Number(budgetMin) : undefined,
        budgetMax: budgetMax ? Number(budgetMax) : undefined,
        notes: notes || undefined,
      })
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      toast.success("Board interest added")
      onSuccess()
    } catch (err) {
      if (isAbortError(err)) return
      console.error("AddBoardInterestDialog.handleSubmit:", err)
      toast.error("Could not add board interest")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add board interest</DialogTitle>
          <DialogDescription>
            Track a specific listing, catalog brand, catalog model, or free-form board request.
          </DialogDescription>
        </DialogHeader>

        <div className="min-w-0 space-y-4">
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={interestType} onValueChange={(v) => setInterestType(v as typeof interestType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="custom">Custom request</SelectItem>
                <SelectItem value="listing">Marketplace listing</SelectItem>
                <SelectItem value="catalog_brand">Catalog brand</SelectItem>
                <SelectItem value="catalog_model">Catalog model</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {interestType === "listing" ? (
            <Popover open={listingPopoverOpen} onOpenChange={setListingPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full min-w-0 justify-between font-normal">
                  {selectedListing ? (
                    <span className="min-w-0 truncate">
                      {[selectedListing.brand, selectedListing.model, selectedListing.dimensions]
                        .filter(Boolean)
                        .join(" · ") || selectedListing.title}
                    </span>
                  ) : (
                    <span className="truncate text-muted-foreground">Search listings…</span>
                  )}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                <Command shouldFilter={false}>
                  <CommandInput value={listingQuery} onValueChange={setListingQuery} placeholder="Brand, model…" />
                  <CommandList>
                    <CommandEmpty>{listingQuery.length < 2 ? "Type to search" : "No listings"}</CommandEmpty>
                    <CommandGroup>
                      {listingHits.map((hit) => (
                        <CommandItem
                          key={hit.id}
                          onSelect={() => {
                            setSelectedListing(hit)
                            setListingPopoverOpen(false)
                          }}
                        >
                          <div className="min-w-0">
                            <p className="truncate">{[hit.brand, hit.model].filter(Boolean).join(" ") || hit.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {hit.dimensions} · {formatCurrency(hit.price)}
                            </p>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          ) : null}

          {interestType === "catalog_brand" ? (
            <Popover open={brandPopoverOpen} onOpenChange={setBrandPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full min-w-0 justify-between font-normal">
                  {selectedBrandHit ? (
                    <span className="min-w-0 truncate">{selectedBrandHit.name}</span>
                  ) : (
                    <span className="truncate text-muted-foreground">Search brands…</span>
                  )}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                <Command shouldFilter={false}>
                  <CommandInput value={brandQuery} onValueChange={setBrandQuery} placeholder="Brand name…" />
                  <CommandList>
                    <CommandEmpty>No brands</CommandEmpty>
                    <CommandGroup>
                      {brandHits.map((hit) => (
                        <CommandItem
                          key={hit.id}
                          onSelect={() => {
                            setSelectedBrandHit(hit)
                            setBrandPopoverOpen(false)
                          }}
                        >
                          {hit.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          ) : null}

          {interestType === "catalog_model" ? (
            <Popover open={modelPopoverOpen} onOpenChange={setModelPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full min-w-0 justify-between font-normal">
                  {selectedModel ? (
                    <span className="min-w-0 truncate">
                      {[selectedModel.brandName, selectedModel.name].filter(Boolean).join(" ")}
                    </span>
                  ) : (
                    <span className="truncate text-muted-foreground">Search catalog models…</span>
                  )}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                <Command shouldFilter={false}>
                  <CommandInput value={modelQuery} onValueChange={setModelQuery} placeholder="Model name…" />
                  <CommandList>
                    <CommandEmpty>{modelQuery.length < 2 ? "Type to search" : "No models"}</CommandEmpty>
                    <CommandGroup>
                      {modelHits.map((hit) => (
                        <CommandItem
                          key={hit.id}
                          onSelect={() => {
                            setSelectedModel(hit)
                            setModelPopoverOpen(false)
                          }}
                        >
                          {[hit.brandName, hit.name].filter(Boolean).join(" ")}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          ) : null}

          {interestType === "custom" ? (
            <>
              <div className="space-y-2">
                <Label>What they want</Label>
                <Textarea
                  value={customDescription}
                  onChange={(e) => setCustomDescription(e.target.value)}
                  placeholder="e.g. 6'2 Lost Puddle Jumper, prefer epoxy…"
                  rows={2}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Brand</Label>
                  <Input value={brand} onChange={(e) => setBrand(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Model</Label>
                  <Input value={model} onChange={(e) => setModel(e.target.value)} />
                </div>
              </div>
            </>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2 sm:col-span-1">
              <Label>Dimensions</Label>
              <Input value={dimensions} onChange={(e) => setDimensions(e.target.value)} placeholder="6'2 x 19.5" />
            </div>
            <div className="space-y-2">
              <Label>Budget min</Label>
              <Input type="number" value={budgetMin} onChange={(e) => setBudgetMin(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Budget max</Label>
              <Input type="number" value={budgetMax} onChange={(e) => setBudgetMax(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={submitting}>
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Add interest
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function LogInteractionDialog({
  open,
  onOpenChange,
  contactId,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  contactId: string
  onSuccess: () => void
}) {
  const [interactionType, setInteractionType] = useState<"call" | "email" | "text" | "in_person" | "note" | "other">(
    "call",
  )
  const [subject, setSubject] = useState("")
  const [notes, setNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) {
      setInteractionType("call")
      setSubject("")
      setNotes("")
    }
  }, [open])

  async function handleSubmit() {
    setSubmitting(true)
    try {
      const result = await logCrmInteractionAction({
        contactId,
        interactionType,
        subject: subject || undefined,
        notes,
      })
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      toast.success("Touchpoint logged")
      onSuccess()
    } catch (err) {
      if (isAbortError(err)) return
      console.error("LogInteractionDialog.handleSubmit:", err)
      toast.error("Could not log touchpoint")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Log touchpoint</DialogTitle>
          <DialogDescription>Record a call, email, or note. This updates last contacted automatically.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={interactionType} onValueChange={(v) => setInteractionType(v as typeof interactionType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(CRM_INTERACTION_LABEL) as typeof interactionType[]).map((t) => (
                  <SelectItem key={t} value={t}>
                    {CRM_INTERACTION_LABEL[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Subject (optional)</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Follow-up on Puddle Jumper" />
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="What was discussed, next steps…"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={submitting || !notes.trim()}>
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save touchpoint
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
