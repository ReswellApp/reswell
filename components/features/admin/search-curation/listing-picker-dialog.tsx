"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Loader2, Plus, Check } from "lucide-react"

type PickerHit = {
  id: string
  slug: string
  title: string
  primary_image_url: string | null
  status: string | null
  hidden_from_site: boolean | null
}

const SEARCH_DEBOUNCE_MS = 220

export function ListingPickerDialog({
  open,
  onOpenChange,
  onPick,
  pinnedIds,
  queryLabel,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onPick: (listingId: string) => Promise<void> | void
  pinnedIds: Set<string>
  queryLabel: string | null
}) {
  const [q, setQ] = useState("")
  const [hits, setHits] = useState<PickerHit[]>([])
  const [loading, setLoading] = useState(false)
  const [addingId, setAddingId] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const runSearch = useCallback(async (term: string) => {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/admin/boards-browse-top-picks/search?q=${encodeURIComponent(term)}&limit=20`,
        { credentials: "include" },
      )
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(typeof body.error === "string" ? body.error : "Search failed")
        setHits([])
        return
      }
      setHits((body.data?.hits ?? []) as PickerHit[])
    } catch {
      setHits([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => void runSearch(q), SEARCH_DEBOUNCE_MS)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [q, open, runSearch])

  useEffect(() => {
    if (open) {
      setQ("")
      void runSearch("")
    }
  }, [open, runSearch])

  async function handlePick(id: string) {
    setAddingId(id)
    try {
      await onPick(id)
    } finally {
      setAddingId(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Pin a listing</DialogTitle>
          <DialogDescription>
            {queryLabel
              ? `Shown when shoppers search “${queryLabel}” and nothing else matches.`
              : "Search active surfboard listings by title."}
          </DialogDescription>
        </DialogHeader>

        <Input
          autoFocus
          placeholder="Search listings by title…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />

        <div className="mt-2 max-h-[360px] space-y-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Searching…
            </div>
          ) : hits.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No listings found.</p>
          ) : (
            hits.map((hit) => {
              const pinned = pinnedIds.has(hit.id)
              return (
                <div
                  key={hit.id}
                  className="flex items-center gap-3 rounded-lg border border-border p-2"
                >
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded bg-muted">
                    {hit.primary_image_url ? (
                      <Image
                        src={hit.primary_image_url}
                        alt=""
                        fill
                        sizes="48px"
                        className="object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{hit.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {hit.status}
                      {hit.hidden_from_site ? " · hidden" : ""}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant={pinned ? "secondary" : "outline"}
                    disabled={pinned || addingId === hit.id}
                    onClick={() => void handlePick(hit.id)}
                  >
                    {addingId === hit.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : pinned ? (
                      <>
                        <Check className="mr-1 h-4 w-4" /> Pinned
                      </>
                    ) : (
                      <>
                        <Plus className="mr-1 h-4 w-4" /> Pin
                      </>
                    )}
                  </Button>
                </div>
              )
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
