"use client"

import { Suspense, useMemo, useState } from "react"
import { toast } from "sonner"
import { Download, LineChart, Link2, Plus, Search } from "lucide-react"
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
import type { PnlEntryRow, PnlStatus } from "@/lib/db/pnl"
import type { PnlLoanRow, PnlLoanRepaymentRow, PnlLoanWithRepayments } from "@/lib/db/pnlLoans"
import {
  computeCapital,
  computeEntry,
  entryMonthKey,
  formatMonthKey,
  summarize,
  summarizeLoans,
  type PnlComputedEntry,
} from "@/lib/pnl-calc"
import {
  deleteLoanAction,
  deleteLoanRepaymentAction,
  deletePnlEntryAction,
  updatePnlEntryAction,
} from "@/lib/actions/pnlAdmin"
import { downloadPnlCsv } from "./pnl-export"
import { PnlSummaryCards } from "./pnl-summary-cards"
import { PnlTable } from "./pnl-table"
import { PnlEntryDialog } from "./pnl-entry-dialog"
import { PnlAttachDialog } from "./pnl-attach-dialog"
import { PnlFinancePanel } from "./pnl-finance-panel"
import { PnlLoanDialog } from "./pnl-loan-dialog"
import { PnlRepaymentDialog } from "./pnl-repayment-dialog"
import { PnlPeriodFilter } from "./pnl-period-filter"

interface PnlAdminClientProps {
  initialEntries: PnlEntryRow[]
  initialLoans: PnlLoanWithRepayments[]
  /** `YYYY-MM` from URL, or null for all-time. */
  selectedYearMonth: string | null
}

type StatusFilter = PnlStatus | "all"
type SortKey = "recent" | "profit" | "name"

export function PnlAdminClient({
  initialEntries,
  initialLoans,
  selectedYearMonth,
}: PnlAdminClientProps) {
  const [entries, setEntries] = useState<PnlEntryRow[]>(initialEntries)
  const [loans, setLoans] = useState<PnlLoanWithRepayments[]>(initialLoans)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const monthFilter = selectedYearMonth ?? "all"
  const periodLabel = selectedYearMonth ? formatMonthKey(selectedYearMonth) : null
  const [sortKey, setSortKey] = useState<SortKey>("recent")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [attachOpen, setAttachOpen] = useState(false)
  const [editing, setEditing] = useState<PnlEntryRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<PnlComputedEntry | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [loanDialogOpen, setLoanDialogOpen] = useState(false)
  const [editingLoan, setEditingLoan] = useState<PnlLoanRow | null>(null)
  const [repaymentOpen, setRepaymentOpen] = useState(false)
  const [repaymentLoanId, setRepaymentLoanId] = useState<string | null>(null)
  const [deleteLoanTarget, setDeleteLoanTarget] = useState<PnlLoanWithRepayments | null>(null)
  const [deletingLoan, setDeletingLoan] = useState(false)

  const computed = useMemo(() => entries.map(computeEntry), [entries])

  const capital = useMemo(
    () => computeCapital(summarize(computed), summarizeLoans(loans)),
    [computed, loans],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const rows = computed.filter((e) => {
      if (statusFilter !== "all" && e.status !== statusFilter) return false
      if (monthFilter !== "all" && entryMonthKey(e) !== monthFilter) return false
      if (q) {
        const haystack = `${e.board_name} ${e.category ?? ""} ${e.notes ?? ""}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })

    rows.sort((a, b) => {
      if (sortKey === "name") return a.board_name.localeCompare(b.board_name)
      if (sortKey === "profit") return (b.profit ?? -Infinity) - (a.profit ?? -Infinity)
      const aDate = a.sale_date ?? a.purchase_date ?? a.created_at
      const bDate = b.sale_date ?? b.purchase_date ?? b.created_at
      return bDate.localeCompare(aDate)
    })
    return rows
  }, [computed, search, statusFilter, monthFilter, sortKey])

  const summary = useMemo(() => summarize(filtered), [filtered])

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

  function upsertLoan(loan: PnlLoanRow) {
    setLoans((prev) => {
      const existing = prev.find((l) => l.id === loan.id)
      if (existing) {
        return prev.map((l) => (l.id === loan.id ? { ...l, ...loan, repayments: l.repayments } : l))
      }
      return [...prev, { ...loan, repayments: [] }]
    })
  }

  function addRepayment(loanId: string, repayment: PnlLoanRepaymentRow) {
    setLoans((prev) =>
      prev.map((l) =>
        l.id === loanId ? { ...l, repayments: [repayment, ...l.repayments] } : l,
      ),
    )
  }

  async function handleDeleteRepayment(loanId: string, repaymentId: string) {
    const result = await deleteLoanRepaymentAction({ id: repaymentId })
    if ("error" in result) {
      toast.error(result.error)
      return
    }
    setLoans((prev) =>
      prev.map((l) =>
        l.id === loanId
          ? { ...l, repayments: l.repayments.filter((r) => r.id !== repaymentId) }
          : l,
      ),
    )
    toast.success("Repayment removed")
  }

  async function confirmDeleteLoan() {
    if (!deleteLoanTarget) return
    setDeletingLoan(true)
    const result = await deleteLoanAction({ id: deleteLoanTarget.id })
    setDeletingLoan(false)
    if ("error" in result) {
      toast.error(result.error)
      return
    }
    setLoans((prev) => prev.filter((l) => l.id !== deleteLoanTarget.id))
    toast.success("Loan deleted")
    setDeleteLoanTarget(null)
  }

  function openAddLoan() {
    setEditingLoan(null)
    setLoanDialogOpen(true)
  }

  function openEditLoan(loan: PnlLoanWithRepayments) {
    setEditingLoan(loan)
    setLoanDialogOpen(true)
  }

  function openRepayment(loanId?: string) {
    setRepaymentLoanId(loanId ?? null)
    setRepaymentOpen(true)
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
      summary,
      capital,
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
              <LineChart className="h-8 w-8 text-neutral-800" aria-hidden />
              P&amp;L Tracker
            </h1>
            {periodLabel ? (
              <span className="inline-flex rounded-full border border-border bg-muted/50 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                {periodLabel}
              </span>
            ) : null}
          </div>
          <p className="max-w-2xl text-muted-foreground">
            {periodLabel
              ? `Profit and loss for ${periodLabel}. Sold boards use their sale month; inventory and listed boards use purchase month.`
              : "Your live profit-and-loss sheet for buying and selling surfboards. Pick a report month, add boards, log fees, and export to CSV."}
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

      <PnlSummaryCards summary={summary} periodLabel={periodLabel ?? undefined} />

      <PnlFinancePanel
        capital={capital}
        scopeNote={
          periodLabel
            ? `Financing and capital below are all-time totals (not limited to ${periodLabel}).`
            : undefined
        }
        loans={loans}
        onAddLoan={openAddLoan}
        onLogRepayment={openRepayment}
        onEditLoan={openEditLoan}
        onDeleteLoan={setDeleteLoanTarget}
        onDeleteRepayment={handleDeleteRepayment}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search board, category, or notes"
            className="pl-9"
          />
        </div>
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
            <SelectItem value="profit">Highest profit</SelectItem>
            <SelectItem value="name">Name (A–Z)</SelectItem>
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
                ? `"${deleteTarget.board_name}" will be removed from your P&L permanently.`
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

      <PnlLoanDialog
        open={loanDialogOpen}
        onOpenChange={setLoanDialogOpen}
        loan={editingLoan}
        onSaved={upsertLoan}
      />

      <PnlRepaymentDialog
        open={repaymentOpen}
        onOpenChange={setRepaymentOpen}
        loans={loans}
        defaultLoanId={repaymentLoanId}
        onSaved={addRepayment}
      />

      <AlertDialog
        open={deleteLoanTarget != null}
        onOpenChange={(open) => !open && setDeleteLoanTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this loan?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteLoanTarget
                ? `"${deleteLoanTarget.name}" and its repayment history will be removed permanently.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingLoan}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                void confirmDeleteLoan()
              }}
              disabled={deletingLoan}
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
