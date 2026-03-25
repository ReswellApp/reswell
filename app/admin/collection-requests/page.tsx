"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Library } from "lucide-react"
import { format } from "date-fns"

type Status = "pending" | "approved" | "declined"

interface CollectionSpotRequest {
  id: string
  user_id: string
  message: string
  social_link: string | null
  status: Status
  created_at: string
  profiles: { display_name: string | null } | null
}

function statusBadge(status: Status) {
  if (status === "pending") return <Badge variant="secondary">Pending</Badge>
  if (status === "approved") return <Badge className="bg-emerald-600 hover:bg-emerald-600">Approved</Badge>
  return <Badge variant="outline">Declined</Badge>
}

export default function AdminCollectionRequestsPage() {
  const [rows, setRows] = useState<CollectionSpotRequest[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function fetchRows() {
      const { data, error } = await supabase
        .from("collection_spot_requests")
        .select("id, user_id, message, social_link, status, created_at, profiles (display_name)")
        .order("created_at", { ascending: false })

      if (!error && data) {
        setRows(data as CollectionSpotRequest[])
      }
      setLoading(false)
    }
    fetchRows()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once on mount
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Collection spot requests</h1>
        <p className="text-muted-foreground">
          Applications for the public{" "}
          <Link href="/collections" className="text-primary underline-offset-4 hover:underline">
            Collections
          </Link>{" "}
          page. After you approve someone in principle, create their row in{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">surf_collections</code> (see script{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">037_surf_collections.sql</code>).
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center">
              <Library className="mx-auto mb-2 h-8 w-8 animate-pulse text-muted-foreground" />
              <p className="text-muted-foreground">Loading…</p>
            </div>
          ) : rows.length === 0 ? (
            <div className="p-8 text-center">
              <Library className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
              <p className="text-muted-foreground">No requests yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Social</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const p = r.profiles
                  const profile = Array.isArray(p) ? p[0] : p
                  const label = profile?.display_name?.trim() || r.user_id.slice(0, 8)
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium text-foreground">
                        <Link href={`/admin/users/${r.user_id}`} className="text-primary hover:underline">
                          {label}
                        </Link>
                      </TableCell>
                      <TableCell>{statusBadge(r.status)}</TableCell>
                      <TableCell className="max-w-md">
                        <p className="line-clamp-4 whitespace-pre-wrap text-sm text-muted-foreground">{r.message}</p>
                      </TableCell>
                      <TableCell className="max-w-[140px]">
                        {r.social_link ? (
                          /^https?:\/\//i.test(r.social_link) ? (
                            <a
                              href={r.social_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="break-all text-sm text-primary hover:underline"
                            >
                              {r.social_link}
                            </a>
                          ) : (
                            <span className="break-all text-sm text-muted-foreground">{r.social_link}</span>
                          )
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {format(new Date(r.created_at), "MMM d, yyyy HH:mm")}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
