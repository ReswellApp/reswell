"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { Loader2, MessageCircle, Search } from "lucide-react"
import type { AdminMarketplaceMessageListRow } from "@/lib/db/adminMarketplaceMessages"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const PAGE_SIZE = 50

function truncate(s: string, max: number): string {
  const t = s.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
}

function participantLabel(
  buyer: string | null | undefined,
  seller: string | null | undefined,
): string {
  const b = buyer?.trim() || "Buyer"
  const s = seller?.trim() || "Seller"
  return `${b} · ${s}`
}

export function AdminMarketplaceMessagesClient() {
  const [rows, setRows] = useState<AdminMarketplaceMessageListRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [searchInput, setSearchInput] = useState("")
  const [appliedSearch, setAppliedSearch] = useState("")
  const [offset, setOffset] = useState(0)

  const fetchRows = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set("limit", String(PAGE_SIZE))
      params.set("offset", String(offset))
      params.set("order", "desc")
      if (appliedSearch.trim()) params.set("q", appliedSearch.trim())

      const res = await fetch(`/api/admin/marketplace-messages?${params}`)
      const body = (await res.json()) as {
        data?: AdminMarketplaceMessageListRow[]
        total?: number
        error?: string
      }
      if (res.ok && body.data) {
        setRows(body.data)
        setTotal(body.total ?? 0)
      } else {
        setRows([])
        setTotal(0)
      }
    } catch {
      setRows([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [appliedSearch, offset])

  useEffect(() => {
    void fetchRows()
  }, [fetchRows])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setAppliedSearch(searchInput.trim())
    setOffset(0)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Marketplace messages</h1>
        <p className="text-muted-foreground">
          All buyer and seller direct messages. Open a thread for full context (read-only).
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <form onSubmit={handleSearch} className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search message text…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-[min(100%,280px)] pl-9"
            />
          </div>
          <Button type="submit" variant="secondary" size="sm">
            Search
          </Button>
        </form>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center gap-2 p-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              Loading…
            </div>
          ) : rows.length === 0 ? (
            <div className="p-8 text-center">
              <MessageCircle className="mx-auto mb-2 h-8 w-8 text-muted-foreground" aria-hidden />
              <p className="text-muted-foreground">No messages found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sent</TableHead>
                  <TableHead>Participants</TableHead>
                  <TableHead>Listing</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead className="min-w-[200px]">Message</TableHead>
                  <TableHead className="text-right">Thread</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const conv = r.conversation
                  const listingTitle = conv.listing?.title?.trim() || "—"
                  const senderName = r.sender?.display_name?.trim() || r.sender_id.slice(0, 8)
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {format(new Date(r.created_at), "MMM d, yyyy HH:mm")}
                      </TableCell>
                      <TableCell className="max-w-[200px] text-sm">
                        <span className="line-clamp-2" title={participantLabel(conv.buyer?.display_name, conv.seller?.display_name)}>
                          {participantLabel(conv.buyer?.display_name, conv.seller?.display_name)}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[180px] text-sm">
                        <span className="line-clamp-2" title={listingTitle}>
                          {listingTitle}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[120px] text-sm">{senderName}</TableCell>
                      <TableCell className="text-sm">
                        <span className="line-clamp-2" title={r.content}>
                          {truncate(r.content, 160)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Link
                          href={`/admin/messages/${conv.id}`}
                          className="text-sm font-medium text-primary underline underline-offset-4 hover:text-primary/90"
                        >
                          Open
                        </Link>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={offset + PAGE_SIZE >= total}
              onClick={() => setOffset(offset + PAGE_SIZE)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
