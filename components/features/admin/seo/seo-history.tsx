"use client"

import { useState } from "react"
import { History, Loader2, RotateCcw } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import type { PageSeoOverrideValues } from "@/lib/seo/types"

interface HistoryRow {
  id: string
  action: "save" | "reset"
  snapshot: PageSeoOverrideValues
  created_at: string
}

interface SeoHistoryProps {
  pageKey: string
  /** Called after a successful restore so the parent can refresh the draft + saved state. */
  onRestored: (snapshot: PageSeoOverrideValues) => void
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  const diff = Date.now() - then
  const mins = Math.round(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.round(hrs / 24)
  return `${days}d ago`
}

export function SeoHistory({ pageKey, onRestored }: SeoHistoryProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<HistoryRow[] | null>(null)
  const [restoringId, setRestoringId] = useState<string | null>(null)

  async function toggle() {
    const next = !open
    setOpen(next)
    if (next && rows === null) {
      setLoading(true)
      try {
        const res = await fetch(`/api/admin/page-seo/${encodeURIComponent(pageKey)}/history`)
        const body = await res.json().catch(() => ({}))
        setRows((body?.data?.history as HistoryRow[]) ?? [])
      } catch {
        setRows([])
      } finally {
        setLoading(false)
      }
    }
  }

  async function restore(row: HistoryRow) {
    setRestoringId(row.id)
    try {
      const res = await fetch(`/api/admin/page-seo/${encodeURIComponent(pageKey)}/history`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshot: row.snapshot }),
      })
      if (!res.ok) throw new Error("Could not restore version")
      onRestored(row.snapshot)
      toast.success("Version restored")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not restore version")
    } finally {
      setRestoringId(null)
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
      >
        <span className="inline-flex items-center gap-1.5">
          <History className="h-3.5 w-3.5" aria-hidden />
          Change history
        </span>
        <span className="text-[11px] normal-case">{open ? "Hide" : "Show"}</span>
      </button>

      {open ? (
        <div className="mt-2">
          {loading ? (
            <div className="flex items-center justify-center py-4 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            </div>
          ) : rows && rows.length > 0 ? (
            <ul className="space-y-1.5">
              {rows.map((row) => (
                <li
                  key={row.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-border px-2.5 py-1.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs text-foreground">
                      {row.action === "reset" ? "Reset to default" : row.snapshot.title || "Saved override"}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{relativeTime(row.created_at)}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 shrink-0 px-2"
                    onClick={() => restore(row)}
                    disabled={restoringId === row.id}
                  >
                    {restoringId === row.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                    ) : (
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                    )}
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-3 text-center text-[11px] text-muted-foreground">No history yet.</p>
          )}
        </div>
      ) : null}
    </div>
  )
}
