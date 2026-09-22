"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ExternalLink, Loader2, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { formatCurrency, type PnlComputedEntry } from "@/lib/pnl-calc"
import type { PnlStatus } from "@/lib/db/pnl"
import type { UpdatePnlEntryInput } from "@/lib/validations/pnl"
import {
  draftFromEntry,
  draftIsDirty,
  draftToUpdatePayload,
  type PnlSheetDraft,
} from "@/lib/pnl-sheet-draft"
import { PnlDateInput, PnlMoneyInput, PnlTextInput } from "./pnl-sheet-cells"

interface PnlTableProps {
  rows: PnlComputedEntry[]
  saving?: boolean
  onEdit: (entry: PnlComputedEntry) => void
  onDelete: (entry: PnlComputedEntry) => void
  onSaveChanges: (entries: UpdatePnlEntryInput[]) => Promise<boolean>
}

const STATUS_VARIANT: Record<PnlStatus, string> = {
  sold: "bg-emerald-100 text-emerald-800",
  listed: "bg-sky-100 text-sky-800",
  inventory: "bg-muted text-muted-foreground",
}

const ROW_GRID =
  "grid grid-cols-[minmax(0,1.5fr)_5.75rem_5.75rem_5.75rem_7rem_4.25rem_2rem] items-center gap-x-3"

function listingHref(row: PnlComputedEntry): string | null {
  if (row.listing_slug || row.listing_id) return `/l/${row.listing_slug || row.listing_id}`
  return null
}

export function PnlTable({ rows, saving = false, onEdit, onDelete, onSaveChanges }: PnlTableProps) {
  const [drafts, setDrafts] = useState<Record<string, PnlSheetDraft>>({})
  const rowById = useMemo(() => new Map(rows.map((row) => [row.id, row])), [rows])

  function draftFor(row: PnlComputedEntry): PnlSheetDraft {
    return drafts[row.id] ?? draftFromEntry(row)
  }

  function patchDraft(id: string, patch: Partial<PnlSheetDraft>) {
    const row = rowById.get(id)
    if (!row) return
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? draftFromEntry(row)), ...patch },
    }))
  }

  const dirtyPayloads = useMemo(() => {
    const payloads: UpdatePnlEntryInput[] = []
    for (const row of rows) {
      const draft = drafts[row.id]
      if (!draft) continue
      const payload = draftToUpdatePayload(draft, row)
      if (payload) payloads.push(payload)
    }
    return payloads
  }, [drafts, rows])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.key !== "s") return
      if (dirtyPayloads.length === 0 || saving) return
      event.preventDefault()
      void onSaveChanges(dirtyPayloads).then((ok) => ok && setDrafts({}))
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [dirtyPayloads, onSaveChanges, saving])

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-12 text-center text-sm text-muted-foreground">
        No boards match these filters yet.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-lg border">
        <div
          className={cn(
            ROW_GRID,
            "border-b bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground",
          )}
        >
          <div>Board</div>
          <div className="text-right">Paid</div>
          <div className="text-right">Asking</div>
          <div className="text-right">Sold</div>
          <div>Status</div>
          <div className="text-right">P/L</div>
          <div />
        </div>
        <ul>
          {rows.map((row) => {
            const draft = draftFor(row)
            const dirty = draftIsDirty(draft, row)
            const paid = Number(draft.purchase_price.replace(/[$,\s]/g, "")) || 0
            const asking = Number(draft.asking_price.replace(/[$,\s]/g, "")) || 0
            const soldFor = Number(draft.sale_price.replace(/[$,\s]/g, "")) || 0
            const result =
              draft.status === "sold" && soldFor > 0 ? soldFor - paid : asking > 0 ? asking - paid : null
            const href = listingHref(row)
            return (
              <li
                key={row.id}
                className={cn("border-b px-3 py-3 last:border-b-0", dirty && "bg-sky-50/70")}
              >
                <div className={ROW_GRID}>
                  <div className="min-w-0 pr-2">
                    <button
                      type="button"
                      onClick={() => onEdit(row)}
                      className="line-clamp-2 text-left text-sm font-medium leading-snug hover:underline"
                    >
                      {row.board_name}
                    </button>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                      {row.category ? <span className="truncate">{row.category}</span> : null}
                      {href ? (
                        <Link
                          href={href}
                          target="_blank"
                          className="inline-flex shrink-0 items-center gap-1 text-violet-600 hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Listing
                        </Link>
                      ) : null}
                    </div>
                  </div>
                  <PnlMoneyInput
                    value={draft.purchase_price}
                    missing={!draft.purchase_price}
                    ariaLabel={`Paid for ${row.board_name}`}
                    onChange={(value) => patchDraft(row.id, { purchase_price: value })}
                  />
                  <PnlMoneyInput
                    value={draft.asking_price}
                    ariaLabel={`Asking price for ${row.board_name}`}
                    onChange={(value) => patchDraft(row.id, { asking_price: value })}
                  />
                  <PnlMoneyInput
                    value={draft.sale_price}
                    placeholder="—"
                    ariaLabel={`Sale price for ${row.board_name}`}
                    onChange={(value) =>
                      patchDraft(row.id, {
                        sale_price: value,
                        status: value.trim() ? "sold" : draft.status === "sold" ? "listed" : draft.status,
                      })
                    }
                  />
                  <Select
                    value={draft.status}
                    onValueChange={(value) => patchDraft(row.id, { status: value as PnlStatus })}
                  >
                    <SelectTrigger className={cn("h-9", STATUS_VARIANT[draft.status])}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inventory">Inventory</SelectItem>
                      <SelectItem value="listed">Listed</SelectItem>
                      <SelectItem value="sold">Sold</SelectItem>
                    </SelectContent>
                  </Select>
                  <div
                    className={cn(
                      "text-right text-sm tabular-nums",
                      result == null
                        ? "text-muted-foreground"
                        : result >= 0
                          ? "text-emerald-600"
                          : "text-rose-600",
                    )}
                  >
                    {result == null ? "—" : `${result >= 0 ? "+" : ""}${formatCurrency(result)}`}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-rose-600"
                    onClick={() => onDelete(row)}
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">Delete {row.board_name}</span>
                  </Button>
                </div>
                <div className="mt-2 flex max-w-xl items-center gap-2 pl-0">
                  <PnlDateInput
                    value={draft.purchase_date}
                    ariaLabel={`Purchase date for ${row.board_name}`}
                    onChange={(value) => patchDraft(row.id, { purchase_date: value })}
                  />
                  <PnlTextInput
                    value={draft.bought_from}
                    placeholder="Bought from"
                    ariaLabel={`Bought from for ${row.board_name}`}
                    onChange={(value) => patchDraft(row.id, { bought_from: value })}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      </div>

      {dirtyPayloads.length > 0 ? (
        <div className="sticky bottom-4 z-10 flex items-center justify-between gap-3 rounded-xl border bg-background/95 px-4 py-3 shadow-lg backdrop-blur">
          <p className="text-sm">
            <span className="font-medium">{dirtyPayloads.length}</span> unsaved
            {dirtyPayloads.length === 1 ? " change" : " changes"}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={saving} onClick={() => setDrafts({})}>
              Discard
            </Button>
            <Button
              size="sm"
              disabled={saving}
              onClick={() => void onSaveChanges(dirtyPayloads).then((ok) => ok && setDrafts({}))}
            >
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save all
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
