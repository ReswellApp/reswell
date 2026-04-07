"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { ExternalLink, Loader2, PlusCircle } from "lucide-react"
import { toast } from "sonner"
import { BRANDS_BASE } from "@/lib/brands/routes"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export type BrandRequestRow = {
  id: string
  user_id: string
  requested_name: string
  website_url: string | null
  short_description: string | null
  founder_name: string | null
  lead_shaper_name: string | null
  location_label: string | null
  about_paragraphs: string[] | null
  logo_url: string | null
  notes: string | null
  status: string
  created_brand_slug: string | null
  created_at: string
}

export function BrandRequestsAdminClient() {
  const [rows, setRows] = useState<BrandRequestRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/brand-requests", { credentials: "include" })
      const data = (await res.json().catch(() => ({}))) as { requests?: BrandRequestRow[]; error?: string }
      if (!res.ok) {
        toast.error(data.error || "Could not load brand requests")
        setRows([])
        return
      }
      setRows(Array.isArray(data.requests) ? data.requests : [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  function statusBadge(status: string) {
    switch (status) {
      case "pending":
        return <Badge variant="secondary">Pending</Badge>
      case "approved":
        return <Badge className="bg-emerald-600 hover:bg-emerald-600">Approved</Badge>
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Brand requests</h1>
          <p className="text-muted-foreground">
            User-submitted brands from the sell flow. Add to brands opens the{" "}
            <Link href={BRANDS_BASE} className="text-primary underline-offset-2 hover:underline">
              /brands
            </Link>{" "}
            Add brand dialog with this request prefilled so you can review, edit, and save.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/admin/listings">Back to listings</Link>
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center gap-2 p-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading…
            </div>
          ) : rows.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">No brand requests yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Website</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground text-sm">
                      {format(new Date(r.created_at), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="font-medium">{r.requested_name}</TableCell>
                    <TableCell>{statusBadge(r.status)}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                      {r.website_url ? (
                        <a
                          href={r.website_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary underline-offset-2 hover:underline"
                        >
                          {r.website_url}
                        </a>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {r.status === "pending" ? (
                        <Button size="sm" asChild>
                          <Link href={`/brands?brandRequest=${encodeURIComponent(r.id)}`}>
                            <PlusCircle className="h-3.5 w-3.5 mr-1.5" />
                            Add to brands
                          </Link>
                        </Button>
                      ) : r.created_brand_slug ? (
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`${BRANDS_BASE}/${r.created_brand_slug}`}>
                            View brand
                            <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
                          </Link>
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
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
