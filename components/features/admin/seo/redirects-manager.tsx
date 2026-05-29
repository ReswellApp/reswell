"use client"

import { useEffect, useState } from "react"
import { ArrowRight, Loader2, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

interface RedirectRow {
  id: string
  from_path: string
  to_path: string
  status_code: number
  enabled: boolean
  note: string | null
  hits: number
}

const STATUS_OPTIONS = [301, 302, 307, 308] as const

export function RedirectsManager() {
  const [rows, setRows] = useState<RedirectRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]>(301)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    let active = true
    fetch("/api/admin/redirects")
      .then((r) => r.json())
      .then((b) => {
        if (active) setRows((b?.data?.redirects as RedirectRow[]) ?? [])
      })
      .catch(() => {})
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [])

  async function create() {
    if (!from.trim() || !to.trim()) {
      toast.error("Both source and destination are required.")
      return
    }
    setCreating(true)
    try {
      const res = await fetch("/api/admin/redirects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromPath: from, toPath: to, statusCode: status, enabled: true }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(typeof body?.error === "string" ? body.error : "Could not create redirect")
      }
      setRows((prev) => [body.data.redirect as RedirectRow, ...prev])
      setFrom("")
      setTo("")
      setStatus(301)
      toast.success("Redirect created")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create redirect")
    } finally {
      setCreating(false)
    }
  }

  async function toggle(row: RedirectRow) {
    setBusyId(row.id)
    try {
      const res = await fetch(`/api/admin/redirects/${row.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromPath: row.from_path,
          toPath: row.to_path,
          statusCode: row.status_code,
          enabled: !row.enabled,
          note: row.note ?? undefined,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error("Could not update redirect")
      setRows((prev) => prev.map((r) => (r.id === row.id ? (body.data.redirect as RedirectRow) : r)))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update redirect")
    } finally {
      setBusyId(null)
    }
  }

  async function remove(id: string) {
    setBusyId(id)
    try {
      const res = await fetch(`/api/admin/redirects/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Could not delete redirect")
      setRows((prev) => prev.filter((r) => r.id !== id))
      toast.success("Redirect deleted")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete redirect")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-sm font-semibold text-foreground">Add a redirect</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Send an old or changed URL to a new one. Applied site-wide within ~1 minute.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_1fr_auto_auto] sm:items-center">
          <Input
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            placeholder="/old-path"
            className="font-mono text-xs"
          />
          <ArrowRight className="hidden h-4 w-4 text-muted-foreground sm:block" aria-hidden />
          <Input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="/new-path or https://…"
            className="font-mono text-xs"
          />
          <select
            value={status}
            onChange={(e) => setStatus(Number(e.target.value) as (typeof STATUS_OPTIONS)[number])}
            className="h-9 rounded-md border border-border bg-background px-2 text-xs text-foreground"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <Button size="sm" onClick={create} disabled={creating}>
            {creating ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Plus className="mr-1.5 h-4 w-4" aria-hidden />
            )}
            Add
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border">
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Active redirects
          </p>
          <span className="text-[11px] text-muted-foreground">{rows.length} total</span>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          </div>
        ) : rows.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            No redirects yet. Add one above.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((row) => (
              <li
                key={row.id}
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5",
                  !row.enabled && "opacity-55",
                )}
              >
                <span className="inline-flex shrink-0 items-center rounded-full border border-border px-2 py-0.5 text-[11px] tabular-nums text-muted-foreground">
                  {row.status_code}
                </span>
                <div className="flex min-w-0 flex-1 items-center gap-2 text-xs">
                  <span className="truncate font-mono text-foreground">{row.from_path}</span>
                  <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="truncate font-mono text-muted-foreground">{row.to_path}</span>
                </div>
                <span className="hidden shrink-0 text-[11px] text-muted-foreground sm:block">
                  {row.hits} hits
                </span>
                <Switch
                  checked={row.enabled}
                  disabled={busyId === row.id}
                  onCheckedChange={() => toggle(row)}
                  aria-label="Toggle redirect"
                />
                <button
                  type="button"
                  onClick={() => remove(row.id)}
                  disabled={busyId === row.id}
                  className="text-muted-foreground transition-colors hover:text-destructive"
                  aria-label="Delete redirect"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
