"use client"

import { useCallback, useEffect, useMemo, useState, useTransition } from "react"
import { format, formatDistanceToNow } from "date-fns"
import {
  ExternalLink,
  Eye,
  Loader2,
  MoreHorizontal,
  RefreshCw,
  Search,
  Store,
  Trash2,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"
import type { FbMarketplaceCatalogRow } from "@/lib/db/fb-marketplace-catalog"
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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

type StatusFilter = "all" | "pending" | "converted" | "dismissed"

function formatUsd(price: number | null): string {
  if (price == null) return "—"
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(price)
}

function rowStatus(row: FbMarketplaceCatalogRow): StatusFilter {
  if (row.converted_at) return "converted"
  if (row.dismissed_at) return "dismissed"
  return "pending"
}

function statusBadge(row: FbMarketplaceCatalogRow) {
  const status = rowStatus(row)
  if (status === "converted") {
    return <Badge className="bg-emerald-600 hover:bg-emerald-600">Converted</Badge>
  }
  if (status === "dismissed") {
    return <Badge variant="destructive">Dismissed</Badge>
  }
  return <Badge variant="secondary">Pending</Badge>
}

function StatCard({
  title,
  value,
  description,
  accent,
}: {
  title: string
  value: number
  description: string
  accent: string
}) {
  return (
    <Card className="overflow-hidden border-0 shadow-sm">
      <CardContent className="relative p-5">
        <div className={cn("absolute inset-0 opacity-[0.07]", accent)} />
        <div className="relative space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-3xl font-bold tracking-tight tabular-nums">{value}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function CatalogImage({
  url,
  alt,
  className,
}: {
  url: string | null
  alt: string
  className?: string
}) {
  if (!url?.trim()) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-md border bg-muted text-xs text-muted-foreground",
          className,
        )}
      >
        No image
      </div>
    )
  }
  return (
    // FB CDN hosts are not in next/image remotePatterns — use native img in admin tooling.
    <img src={url} alt={alt} className={cn("rounded-md border object-cover", className)} />
  )
}

export function FbCatalogAdminClient() {
  const [rows, setRows] = useState<FbMarketplaceCatalogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [active, setActive] = useState<FbMarketplaceCatalogRow | null>(null)
  const [draftNotes, setDraftNotes] = useState("")
  const [deleteTarget, setDeleteTarget] = useState<FbMarketplaceCatalogRow | null>(null)
  const [savePending, startSaveTransition] = useTransition()
  const [actionPending, startActionTransition] = useTransition()

  const load = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    if (mode === "refresh") setRefreshing(true)
    else setLoading(true)

    try {
      const res = await fetch("/api/admin/fb-marketplace-catalog", { credentials: "include" })
      const data = (await res.json().catch(() => ({}))) as {
        rows?: FbMarketplaceCatalogRow[]
        error?: string
      }
      if (!res.ok) {
        toast.error(data.error || "Could not load FB catalog rows")
        setRows([])
      } else {
        setRows(Array.isArray(data.rows) ? data.rows : [])
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const stats = useMemo(() => {
    let pending = 0
    let converted = 0
    let dismissed = 0
    for (const row of rows) {
      const status = rowStatus(row)
      if (status === "pending") pending += 1
      else if (status === "converted") converted += 1
      else dismissed += 1
    }
    return { pending, converted, dismissed, total: rows.length }
  }, [rows])

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((row) => {
      if (statusFilter !== "all" && rowStatus(row) !== statusFilter) return false
      if (!q) return true
      const haystack = [
        row.name,
        row.location,
        row.condition,
        row.description,
        row.admin_notes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [rows, search, statusFilter])

  const openDetail = useCallback((row: FbMarketplaceCatalogRow) => {
    setActive(row)
    setDraftNotes(row.admin_notes ?? "")
  }, [])

  const patchRow = useCallback(
    async (id: string, body: Record<string, unknown>) => {
      const res = await fetch(`/api/admin/fb-marketplace-catalog/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = (await res.json().catch(() => ({}))) as {
        row?: FbMarketplaceCatalogRow
        error?: string
      }
      if (!res.ok || !data.row) {
        throw new Error(data.error || "Update failed")
      }
      setRows((prev) => prev.map((r) => (r.id === id ? data.row! : r)))
      setActive((prev) => (prev?.id === id ? data.row! : prev))
      return data.row
    },
    [],
  )

  const handleSaveNotes = () => {
    if (!active) return
    startSaveTransition(async () => {
      try {
        await patchRow(active.id, { admin_notes: draftNotes.trim() || null })
        toast.success("Notes saved")
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not save notes")
      }
    })
  }

  const handleDismiss = (row: FbMarketplaceCatalogRow, dismiss: boolean) => {
    startActionTransition(async () => {
      try {
        await patchRow(row.id, {
          dismissed_at: dismiss ? new Date().toISOString() : null,
        })
        toast.success(dismiss ? "Listing dismissed" : "Dismissal cleared")
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not update listing")
      }
    })
  }

  const handleDelete = () => {
    if (!deleteTarget) return
    const id = deleteTarget.id
    startActionTransition(async () => {
      try {
        const res = await fetch(`/api/admin/fb-marketplace-catalog/${id}`, {
          method: "DELETE",
          credentials: "include",
        })
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        if (!res.ok) {
          throw new Error(data.error || "Delete failed")
        }
        setRows((prev) => prev.filter((r) => r.id !== id))
        if (active?.id === id) setActive(null)
        setDeleteTarget(null)
        toast.success("Listing deleted")
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not delete listing")
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Store className="h-6 w-6 text-muted-foreground" />
            <h1 className="text-2xl font-bold text-foreground">FB Marketplace catalog</h1>
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Staging table for Thunderbit / Facebook Marketplace imports. Review listings here
            before promoting them into brand model variants.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => void load("refresh")}
          disabled={loading || refreshing}
        >
          {refreshing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Pending"
          value={stats.pending}
          description="Awaiting review"
          accent="bg-amber-500"
        />
        <StatCard
          title="Converted"
          value={stats.converted}
          description="Promoted to catalog variants"
          accent="bg-emerald-500"
        />
        <StatCard
          title="Dismissed"
          value={stats.dismissed}
          description="Hidden from triage queue"
          accent="bg-rose-500"
        />
        <StatCard
          title="Total"
          value={stats.total}
          description="All imported rows"
          accent="bg-sky-500"
        />
      </div>

      <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <TabsList className="flex w-full flex-wrap justify-start gap-1 sm:w-auto">
            <TabsTrigger value="all">All ({stats.total})</TabsTrigger>
            <TabsTrigger value="pending">Pending ({stats.pending})</TabsTrigger>
            <TabsTrigger value="converted">Converted ({stats.converted})</TabsTrigger>
            <TabsTrigger value="dismissed">Dismissed ({stats.dismissed})</TabsTrigger>
          </TabsList>
          <div className="relative w-full lg:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, location, description…"
              className="pl-9"
            />
          </div>
        </div>

        <TabsContent value={statusFilter} className="mt-4">
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center gap-2 p-12 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Loading catalog…
                </div>
              ) : filteredRows.length === 0 ? (
                <p className="p-8 text-center text-sm text-muted-foreground">
                  No listings match this view.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[72px]">Image</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Condition</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Imported</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>
                          <CatalogImage
                            url={row.image_url}
                            alt={row.name}
                            className="h-12 w-12"
                          />
                        </TableCell>
                        <TableCell className="max-w-[260px]">
                          <button
                            type="button"
                            onClick={() => openDetail(row)}
                            className="line-clamp-2 text-left font-medium text-foreground hover:underline"
                          >
                            {row.name}
                          </button>
                        </TableCell>
                        <TableCell className="whitespace-nowrap tabular-nums">
                          {formatUsd(row.price)}
                        </TableCell>
                        <TableCell className="max-w-[160px] truncate text-sm text-muted-foreground">
                          {row.location ?? "—"}
                        </TableCell>
                        <TableCell className="max-w-[140px] truncate text-sm">
                          {row.condition ?? "—"}
                        </TableCell>
                        <TableCell>{statusBadge(row)}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                          {format(new Date(row.created_at), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Open actions</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openDetail(row)}>
                                <Eye className="mr-2 h-4 w-4" />
                                Review
                              </DropdownMenuItem>
                              {row.source_url ? (
                                <DropdownMenuItem asChild>
                                  <a href={row.source_url} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="mr-2 h-4 w-4" />
                                    Open on Facebook
                                  </a>
                                </DropdownMenuItem>
                              ) : null}
                              <DropdownMenuSeparator />
                              {row.dismissed_at ? (
                                <DropdownMenuItem onClick={() => handleDismiss(row, false)}>
                                  Clear dismissal
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem onClick={() => handleDismiss(row, true)}>
                                  <XCircle className="mr-2 h-4 w-4" />
                                  Dismiss
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => setDeleteTarget(row)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
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
        </TabsContent>
      </Tabs>

      <Sheet open={!!active} onOpenChange={(open) => !open && setActive(null)}>
        <SheetContent className="flex w-full flex-col overflow-y-auto sm:max-w-xl">
          {active ? (
            <>
              <SheetHeader>
                <SheetTitle className="pr-8 text-left leading-snug">{active.name}</SheetTitle>
                <SheetDescription className="text-left">
                  Imported{" "}
                  {formatDistanceToNow(new Date(active.created_at), { addSuffix: true })}
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-5 py-4">
                <div className="flex gap-4">
                  <CatalogImage
                    url={active.image_url}
                    alt={active.name}
                    className="h-32 w-32 shrink-0"
                  />
                  <div className="space-y-2 text-sm">
                    <div>
                      <p className="text-muted-foreground">Price</p>
                      <p className="font-medium tabular-nums">{formatUsd(active.price)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Location</p>
                      <p>{active.location ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Condition</p>
                      <p>{active.condition ?? "—"}</p>
                    </div>
                    <div>{statusBadge(active)}</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Description</Label>
                  <p className="whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-sm">
                    {active.description?.trim() || "—"}
                  </p>
                </div>

                {active.source_url ? (
                  <div className="space-y-2">
                    <Label>Facebook listing</Label>
                    <a
                      href={active.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm text-primary underline-offset-2 hover:underline"
                    >
                      View on Marketplace
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                ) : null}

                <div className="space-y-2">
                  <Label htmlFor="fbcatalog-admin-notes">Admin notes</Label>
                  <Textarea
                    id="fbcatalog-admin-notes"
                    value={draftNotes}
                    onChange={(e) => setDraftNotes(e.target.value)}
                    rows={4}
                    placeholder="Internal review notes…"
                  />
                </div>
              </div>

              <SheetFooter className="mt-auto flex-col gap-2 sm:flex-col">
                <Button onClick={handleSaveNotes} disabled={savePending || actionPending}>
                  {savePending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Save notes
                </Button>
                {active.dismissed_at ? (
                  <Button
                    variant="outline"
                    onClick={() => handleDismiss(active, false)}
                    disabled={savePending || actionPending}
                  >
                    Clear dismissal
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => handleDismiss(active, true)}
                    disabled={savePending || actionPending}
                  >
                    Dismiss listing
                  </Button>
                )}
                <Button
                  variant="destructive"
                  onClick={() => setDeleteTarget(active)}
                  disabled={savePending || actionPending}
                >
                  Delete listing
                </Button>
              </SheetFooter>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this listing?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes{" "}
              <span className="font-medium text-foreground">{deleteTarget?.name}</span> from the FB
              Marketplace staging table. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleDelete()
              }}
              disabled={actionPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {actionPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
