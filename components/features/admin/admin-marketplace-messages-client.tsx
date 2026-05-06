"use client"

import { useCallback, useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { Loader2, MessageCircle, Search } from "lucide-react"
import type { AdminMarketplaceConversationListRow } from "@/lib/db/adminMarketplaceMessages"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { VerifiedBadge } from "@/components/verified-badge"
import { capitalizeWords } from "@/lib/listing-labels"
import { proxiedListingImageSrc } from "@/lib/listing-media-proxy-url"
import { AdminStartUserConversationDialog } from "@/components/features/admin/admin-start-user-conversation-dialog"
import { cn } from "@/lib/utils"

const PAGE_SIZE = 50

function getLastActivityMs(conv: AdminMarketplaceConversationListRow): number {
  let maxMs = 0
  if (conv.last_message_at) {
    const fromConv = new Date(conv.last_message_at).getTime()
    if (Number.isFinite(fromConv)) maxMs = fromConv
  }
  const last = conv.messages?.[0]
  if (last) {
    const t = new Date(last.created_at).getTime()
    if (Number.isFinite(t) && t > maxMs) maxMs = t
  }
  return maxMs
}

function formatThreadPreview(conv: AdminMarketplaceConversationListRow): string {
  const last = conv.messages?.[0]
  const listingTitle = conv.listing?.title?.trim() ? capitalizeWords(conv.listing.title.trim()) : ""
  if (!last?.content?.trim()) {
    return listingTitle || "No messages yet"
  }
  const buyerName = conv.buyer?.display_name?.trim() || "Buyer"
  const sellerName = conv.seller?.display_name?.trim() || "Seller"
  const fromName = last.sender_id === conv.buyer_id ? buyerName : sellerName
  const body = last.content.trim()
  const segment = `${fromName} · ${body}`
  if (listingTitle) return `${listingTitle} · ${segment}`
  return segment
}

export function AdminMarketplaceMessagesClient() {
  const [rows, setRows] = useState<AdminMarketplaceConversationListRow[]>([])
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
      if (appliedSearch.trim()) params.set("q", appliedSearch.trim())

      const res = await fetch(`/api/admin/marketplace-conversations?${params}`)
      const body = (await res.json()) as {
        data?: AdminMarketplaceConversationListRow[]
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

  const groupedShell =
    "overflow-hidden rounded-[20px] border border-border/70 bg-card shadow-[0_1px_2px_rgba(17,17,17,0.04)] dark:shadow-none dark:border-border"

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Marketplace messages</h1>
        <p className="text-muted-foreground">
          One row per buyer↔seller thread, newest first. Open a thread to read messages, send PDFs,
          or use{" "}
          <span className="font-medium text-foreground">Message a user</span> to start a chat with
          any member.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <form onSubmit={handleSearch} className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search names, listings, or message text…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-[min(100%,320px)] pl-9"
            />
          </div>
          <Button type="submit" variant="secondary" size="sm">
            Search
          </Button>
        </form>
        <AdminStartUserConversationDialog />
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
              <p className="text-muted-foreground">No conversations found</p>
            </div>
          ) : (
            <div className={cn("divide-y divide-border/40", groupedShell)}>
              {rows.map((conv) => {
                const lastMs = getLastActivityMs(conv)
                const listingTitle = conv.listing?.title?.trim()
                  ? capitalizeWords(conv.listing.title.trim())
                  : undefined
                const thumb = conv.listing?.listing_images?.[0]?.url
                const preview = formatThreadPreview(conv)

                return (
                  <Link
                    key={conv.id}
                    href={`/admin/messages/${conv.id}`}
                    className="flex items-center gap-4 px-4 py-4 transition-colors hover:bg-muted/35 active:bg-muted/55 sm:px-5"
                  >
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-muted ring-1 ring-border/35">
                      {thumb ? (
                        <Image
                          src={proxiedListingImageSrc(thumb)}
                          alt={listingTitle || "Listing"}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <MessageCircle
                            className="h-6 w-6 text-muted-foreground/70"
                            strokeWidth={1.5}
                            aria-hidden
                          />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
                          <span className="truncate text-[15px] font-semibold leading-tight text-foreground sm:text-[16px]">
                            {conv.buyer?.display_name?.trim() || "Buyer"}
                          </span>
                          {conv.buyer?.shop_verified ? (
                            <span className="shrink-0">
                              <VerifiedBadge size="sm" />
                            </span>
                          ) : null}
                          <span className="shrink-0 text-muted-foreground" aria-hidden>
                            ·
                          </span>
                          <span className="truncate text-[15px] font-semibold leading-tight text-foreground sm:text-[16px]">
                            {conv.seller?.display_name?.trim() || "Seller"}
                          </span>
                          {conv.seller?.shop_verified ? (
                            <span className="shrink-0">
                              <VerifiedBadge size="sm" />
                            </span>
                          ) : null}
                        </div>
                        {lastMs > 0 ? (
                          <time
                            className="shrink-0 text-[13px] tabular-nums text-muted-foreground"
                            dateTime={new Date(lastMs).toISOString()}
                          >
                            {formatDistanceToNow(new Date(lastMs), { addSuffix: true })}
                          </time>
                        ) : null}
                      </div>
                      <p
                        className="mt-1 truncate text-[14px] leading-snug text-muted-foreground sm:text-[15px]"
                        title={preview}
                      >
                        {preview}
                      </p>
                    </div>
                  </Link>
                )
              })}
            </div>
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
