"use client"

import { Suspense, useMemo, useState } from "react"
import { toast } from "sonner"
import { Download, Landmark, Link2, Plus, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import type { PnlEntryRow, PnlSourceKind, PnlStatus } from "@/lib/db/pnl"
import {
  computeEntry,
  entryMonthKey,
  formatMonthKey,
  summarizeBalanceSheet,
  type PnlComputedEntry,
} from "@/lib/pnl-calc"
import { deletePnlEntryAction, updatePnlEntryAction } from "@/lib/actions/pnlAdmin"
import { downloadPnlCsv } from "./pnl-export"
import { PnlBalanceSheet } from "./pnl-balance-sheet"
import { PnlTable } from "./pnl-table"
import { PnlEntryDialog } from "./pnl-entry-dialog"
import { PnlAttachDialog } from "./pnl-attach-dialog"
import { PnlPeriodFilter } from "./pnl-period-filter"

interface PnlAdminClientProps {
  initialEntries: PnlEntryRow[]
  /** `YYYY-MM` from URL, or null for all-time. */
  selectedYearMonth: string | null
}

type StatusFilter = PnlStatus | "all"
type SourceFilter = PnlSourceKind | "all"
type SortKey = "recent" | "asking" | "name"

export function PnlAdminClient({
  initialEntries,
  selectedYearMonth,
}: PnlAdminClientProps) {
  const [entries, setEntries] = useState<PnlEntryRow[]>(initialEntries)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all")
  const monthFilter = selectedYearMonth ?? "all"
  const periodLabel = selectedYearMonth ? formatMonthKey(selectedYearMonth) : null
  const [sortKey, setSortKey] = useState<SortKey>("recent")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [attachOpen, setAttachOpen] = useState(false)
  const [editing, setEditing] = useState<PnlEntryRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<PnlComputedEntry | null>(null)
  const [deleting, setDeleting] = useState(false)

  const computed = useMemo(() => entries.map(computeEntry), [entries])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const rows = computed.filter((e) => {
      if (statusFilter !== "all" && e.status !== statusFilter) return false
      if (sourceFilter !== "all" && e.source_kind !== sourceFilter) return false
      if (monthFilter !== "all" && entryMonthKey(e) !== monthFilter) return false
      if (q) {
        const haystack =
          `${e.board_name} ${e.category ?? ""} ${e.bought_from ?? ""} ${e.notes ?? ""}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })

    rows.sort((a, b) => {
      if (sortKey === "name") return a.board_name.localeCompare(b.board_name)
      if (sortKey === "asking") return (b.asking_price ?? -1) - (a.asking_price ?? -1)
      const aDate = a.sale_date ?? a.purchase_date ?? a.created_at
      const bDate = b.sale_date ?? b.purchase_date ?? b.created_at
      return bDate.localeCompare(aDate)
    })
    return rows
  }, [computed, search, statusFilter, sourceFilter, monthFilter, sortKey])

  const sheet = useMemo(() => summarizeBalanceSheet(filtered), [filtered])

  function upsertEntry(row: PnlEntryRow) {
    setEntries((prev) => {
      const exists = prev.some((e) => e.id === row.id)
      return exists ? prev.map((e) => (e.id === row.id ? row : e)) : [row, ...prev]
    })
  }

  async function handleUpdatePurchasePrice(id: string, price: number): Promise<boolean> {
    const result = await updatePnlEntryAction({ id, purchasePrice: price })
    if ("error" in result) {
      toast.error(result.error)
      return false
    }
    upsertEntry(result.data)
    return true
  }

  async function handleUpdateAskingPrice(id: string, price: number): Promise<boolean> {
    const result = await updatePnlEntryAction({ id, askingPrice: price })
    if ("error" in result) {
      toast.error(result.error)
      return false
    }
    upsertEntry(result.data)
    return true
  }

  function openCreate() {
    setEditing(null)
    setDialogOpen(true)
  }

  function openEdit(entry: PnlEntryRow) {
    setEditing(entry)
    setDialogOpen(true)
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const result = await deletePnlEntryAction({ id: deleteTarget.id })
    setDeleting(false)
    if ("error" in result) {
      toast.error(result.error)
      return
    }
    setEntries((prev) => prev.filter((e) => e.id !== deleteTarget.id))
    toast.success("Board deleted")
    setDeleteTarget(null)
  }

  function handleExport() {
    if (filtered.length === 0) {
      toast.error("Nothing to export for these filters")
      return
    }
    const scope = monthFilter
    const scopeLabel = periodLabel ?? "All time"
    downloadPnlCsv(filtered, {
      scope,
      scopeLabel,
      sheet,
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
              <Landmark className="h-8 w-8 text-neutral-800" aria-hidden />
              Balance sheet
            </h1>
            {periodLabel ? (
              <span className="inline-flex rounded-full border border-border bg-muted/50 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                {periodLabel}
              </span>
            ) : null}
          </div>
          <p className="max-w-2xl text-muted-foreground">
            Inventory you bought on Reswell or outside — title, source, cost, date, and asking
            price.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <Suspense fallback={null}>
            <PnlPeriodFilter selectedYearMonth={selectedYearMonth} />
          </Suspense>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button variant="outline" onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Button variant="outline" onClick={() => setAttachOpen(true)}>
              <Link2 className="mr-2 h-4 w-4" />
              Attach from Reswell
            </Button>
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Add board
            </Button>
          </div>
        </div>
      </div>

      <PnlBalanceSheet sheet={sheet} periodLabel={periodLabel ?? undefined} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title, source, or notes"
            className="pl-9"
          />
        </div>
        <Select value={sourceFilter} onValueChange={(v) => setSourceFilter(v as SourceFilter)}>
          <SelectTrigger className="w-full sm:w-[170px]">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sources</SelectItem>
            <SelectItem value="reswell">Reswell</SelectItem>
            <SelectItem value="outside">Outside</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="w-full sm:w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="inventory">Inventory</SelectItem>
            <SelectItem value="listed">Listed</SelectItem>
            <SelectItem value="sold">Sold</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
          <SelectTrigger className="w-full sm:w-[150px]">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Most recent</SelectItem>
            <SelectItem value="asking">Highest asking</SelectItem>
            <SelectItem value="name">Title (A–Z)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {periodLabel && filtered.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          No boards attributed to {periodLabel}. Try another month or add a board with a purchase or
          sale date in this month.
        </p>
      ) : null}

      <PnlTable
        rows={filtered}
        onEdit={openEdit}
        onDelete={setDeleteTarget}
        onUpdatePurchasePrice={handleUpdatePurchasePrice}
        onUpdateAskingPrice={handleUpdateAskingPrice}
      />

      <PnlEntryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        entry={editing}
        onSaved={upsertEntry}
      />

      <PnlAttachDialog open={attachOpen} onOpenChange={setAttachOpen} onAttached={upsertEntry} />

      <AlertDialog open={deleteTarget != null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this board?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `"${deleteTarget.board_name}" will be removed from the balance sheet permanently.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                void confirmDelete()
              }}
              disabled={deleting}
              className="bg-rose-600 hover:bg-rose-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
