"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ExternalLink, Eye, EyeOff, Loader2, Plus, Search } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import type { HowItWorksBuyerCurationSlot } from "@/lib/db/home-how-it-works-buyer-curation"

type SlotMeta = {
  board_type: HowItWorksBuyerCurationSlot
  listing_id: string
  listing: {
    id: string
    slug: string
    title: string
    status: string | null
    hidden_from_site: boolean | null
    hidden_from_homepage: boolean | null
    board_type: string | null
    card_image_url: string | null
  }
}

type SearchHit = {
  id: string
  slug: string
  title: string
  primary_image_url: string | null
  hidden_from_homepage?: boolean | null
  already_assigned_here: boolean
  assigned_board_type_other: HowItWorksBuyerCurationSlot | null
}

const SLOT_LABELS: Record<HowItWorksBuyerCurationSlot, string> = {
  shortboard: "Shortboard photo (left)",
  hybrid: "Hybrid photo (middle)",
  longboard: "Longboard photo (right)",
}

const plusOutlineClass =
  "h-10 w-10 shrink-0 rounded-full border border-border bg-background shadow-sm hover:bg-muted/60"

function slotSubtitle(row: SlotMeta["listing"]): string | null {
  if (row.status !== "active") return "Listing not active — falls back until active again."
  if (row.hidden_from_site === true) return "Hidden site-wide — won’t appear until restored."
  if (row.hidden_from_homepage === true) return "Hidden from homepage — won’t use this pick on the homepage."
  return null
}

export function HomeHowItWorksBuyerCurator({ isAdmin, className }: { isAdmin: boolean; className?: string }) {
  const router = useRouter()
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [slots, setSlots] = React.useState<SlotMeta[]>([])
  const [loadingSlots, setLoadingSlots] = React.useState(false)

  const [activeSlot, setActiveSlot] = React.useState<HowItWorksBuyerCurationSlot>("shortboard")
  const [searchQuery, setSearchQuery] = React.useState("")
  const [searchHits, setSearchHits] = React.useState<SearchHit[]>([])
  const [searching, setSearching] = React.useState(false)
  const [addingId, setAddingId] = React.useState<string | null>(null)
  const [deletingSlot, setDeletingSlot] = React.useState<HowItWorksBuyerCurationSlot | null>(null)
  const [homepageToggleId, setHomepageToggleId] = React.useState<string | null>(null)

  const loadSlots = React.useCallback(async () => {
    setLoadingSlots(true)
    try {
      const res = await fetch("/api/admin/home-how-it-works-buyer", { credentials: "include" })
      const json = (await res.json().catch(() => ({}))) as { data?: { slots: SlotMeta[] }; error?: string }
      if (!res.ok) {
        toast.error(typeof json.error === "string" ? json.error : "Could not load picks")
        return
      }
      setSlots(Array.isArray(json.data?.slots) ? json.data!.slots : [])
    } finally {
      setLoadingSlots(false)
    }
  }, [])

  const runSearch = React.useCallback(async (slot: HowItWorksBuyerCurationSlot, q: string) => {
    setSearching(true)
    try {
      const params = new URLSearchParams()
      params.set("board_type", slot)
      if (q.trim()) params.set("q", q.trim())
      params.set("limit", "20")
      const res = await fetch(`/api/admin/home-how-it-works-buyer/search?${params.toString()}`, {
        credentials: "include",
      })
      const json = (await res.json().catch(() => ({}))) as { data?: { hits: SearchHit[] }; error?: string }
      if (!res.ok) {
        toast.error(typeof json.error === "string" ? json.error : "Search failed")
        return
      }
      setSearchHits(Array.isArray(json.data?.hits) ? json.data!.hits : [])
    } finally {
      setSearching(false)
    }
  }, [])

  React.useEffect(() => {
    if (!dialogOpen) return
    void loadSlots()
    setActiveSlot("shortboard")
    setSearchQuery("")
  }, [dialogOpen, loadSlots])

  React.useEffect(() => {
    if (!dialogOpen) return
    const handle = window.setTimeout(() => {
      void runSearch(activeSlot, searchQuery)
    }, 200)
    return () => window.clearTimeout(handle)
  }, [dialogOpen, activeSlot, searchQuery, runSearch])

  React.useEffect(() => {
    if (!dialogOpen) return
    setSearchQuery("")
  }, [activeSlot, dialogOpen])

  async function onToggleHomepageHidden(listingId: string, currentlyHidden: boolean) {
    setHomepageToggleId(listingId)
    try {
      const res = await fetch(`/api/admin/listings/${encodeURIComponent(listingId)}/homepage-visibility`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ hidden_from_homepage: !currentlyHidden }),
      })
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        toast.error(typeof json.error === "string" ? json.error : "Could not update visibility")
        return
      }
      toast.success(currentlyHidden ? "Listing visible on homepage again" : "Listing hidden from homepage")
      setSlots((prev) =>
        prev.map((s) =>
          s.listing_id === listingId
            ? { ...s, listing: { ...s.listing, hidden_from_homepage: !currentlyHidden } }
            : s,
        ),
      )
      setSearchHits((prev) =>
        prev.map((h) =>
          h.id === listingId ? { ...h, hidden_from_homepage: !currentlyHidden } : h,
        ),
      )
      router.refresh()
    } finally {
      setHomepageToggleId(null)
    }
  }

  async function onAssign(slot: HowItWorksBuyerCurationSlot, listingId: string) {
    setAddingId(listingId)
    try {
      const res = await fetch("/api/admin/home-how-it-works-buyer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ board_type: slot, listing_id: listingId }),
      })
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        toast.error(typeof json.error === "string" ? json.error : "Could not save pick")
        return
      }
      toast.success("Buyer tab image updated")
      await loadSlots()
      void runSearch(slot, searchQuery)
      router.refresh()
    } finally {
      setAddingId(null)
    }
  }

  async function onClearSlot(slot: HowItWorksBuyerCurationSlot) {
    setDeletingSlot(slot)
    try {
      const params = new URLSearchParams()
      params.set("board_type", slot)
      const res = await fetch(`/api/admin/home-how-it-works-buyer?${params.toString()}`, {
        method: "DELETE",
        credentials: "include",
      })
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        toast.error(typeof json.error === "string" ? json.error : "Could not clear pick")
        return
      }
      toast.success("Using automatic photo for this column")
      await loadSlots()
      void runSearch(slot, searchQuery)
      router.refresh()
    } finally {
      setDeletingSlot(null)
    }
  }

  if (!isAdmin) return null

  return (
    <>
      <Button
        type="button"
        size="icon"
        variant="outline"
        className={cn(plusOutlineClass, className)}
        onClick={() => setDialogOpen(true)}
        aria-label="Edit How it works buyer photos"
        title="Edit How it works buyer photos"
      >
        <Plus className="h-5 w-5" />
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          className={cn(
            "grid max-h-[min(90dvh,760px)] w-[min(100%,calc(100vw-1.5rem))] min-w-0 max-w-xl gap-4 overflow-x-hidden overflow-y-auto sm:max-w-xl",
            "p-4 sm:p-6",
          )}
        >
          <DialogHeader className="shrink-0 min-w-0 text-left sm:text-left">
            <DialogTitle>How it works — buyer photos</DialogTitle>
            <DialogDescription className="text-pretty [overflow-wrap:anywhere]">
              Choose one listing per column for the &ldquo;I&apos;m buying&rdquo; tab. When a pick is set and
              valid, those photos replace the newest-listing autopicks. Clearing a column falls back automatically.
              Use eye icons to hide a listing everywhere on the homepage without removing it elsewhere.
            </DialogDescription>
          </DialogHeader>

          {loadingSlots ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <ul className="space-y-2">
                {slots.map((s) => (
                  <li
                    key={s.board_type}
                    className="flex gap-3 rounded-lg border border-border/80 bg-muted/15 p-2 sm:p-3"
                  >
                    <div className="relative h-16 w-[4.75rem] shrink-0 overflow-hidden rounded-md bg-muted">
                      {s.listing.card_image_url ? (
                        <Image
                          src={s.listing.card_image_url}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="76px"
                          unoptimized={s.listing.card_image_url.startsWith("/")}
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center px-1 text-center text-[9px] text-muted-foreground">
                          Auto pick
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {SLOT_LABELS[s.board_type]}
                      </p>
                      {s.listing_id ? (
                        <>
                          <Link
                            href={`/boards/${s.listing.slug}`}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-0.5 line-clamp-2 text-sm font-medium text-foreground hover:underline"
                          >
                            {s.listing.title}
                          </Link>
                          {slotSubtitle(s.listing) ? (
                            <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-400">{slotSubtitle(s.listing)}</p>
                          ) : null}
                        </>
                      ) : (
                        <p className="mt-0.5 text-sm text-muted-foreground">Automatically uses the newest listing photo.</p>
                      )}
                    </div>
                    {s.listing_id ? (
                      <div className="flex shrink-0 flex-col gap-1 sm:flex-row sm:items-start">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-9 w-9"
                          title={s.listing.hidden_from_homepage ? "Show on homepage" : "Hide from homepage"}
                          disabled={homepageToggleId === s.listing_id}
                          onClick={() =>
                            void onToggleHomepageHidden(s.listing_id, s.listing.hidden_from_homepage === true)
                          }
                          aria-label="Toggle homepage visibility"
                        >
                          {homepageToggleId === s.listing_id ? (
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          ) : s.listing.hidden_from_homepage ? (
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-9 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          disabled={deletingSlot !== null}
                          onClick={() => void onClearSlot(s.board_type)}
                        >
                          {deletingSlot === s.board_type ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            "Clear"
                          )}
                        </Button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>

              <Tabs value={activeSlot} onValueChange={(v) => setActiveSlot(v as HowItWorksBuyerCurationSlot)}>
                <TabsList className="grid w-full grid-cols-3">
                  {(Object.keys(SLOT_LABELS) as HowItWorksBuyerCurationSlot[]).map((k) => (
                    <TabsTrigger key={k} value={k} className="text-[11px] sm:text-xs">
                      {k}
                    </TabsTrigger>
                  ))}
                </TabsList>
                <div className="relative mt-4 w-full min-w-0 max-w-full">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={`Search active ${activeSlot} listings…`}
                    className="w-full min-w-0 pl-9"
                    aria-label={`Search ${activeSlot} listings`}
                  />
                </div>
                {(Object.keys(SLOT_LABELS) as HowItWorksBuyerCurationSlot[]).map((slot) => (
                  <TabsContent key={slot} value={slot} className="mt-3 flex flex-col gap-3 focus-visible:outline-none">
                    {searching && activeSlot === slot && searchHits.length === 0 ? (
                      <div className="flex justify-center py-6">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : searchHits.length === 0 && activeSlot === slot ? (
                      <p className="rounded-md border border-dashed border-border/80 px-3 py-4 text-center text-xs text-muted-foreground">
                        No listings found.
                      </p>
                    ) : activeSlot === slot ? (
                      <ul className="max-h-[min(280px,34vh)] min-w-0 space-y-2 overflow-y-auto overflow-x-hidden pr-0.5">
                        {searchHits.map((hit) => (
                          <li
                            key={hit.id}
                            className="flex gap-2 rounded-lg border border-border/80 bg-muted/20 p-2 sm:gap-3"
                          >
                            <div className="relative h-14 w-[3.85rem] shrink-0 overflow-hidden rounded-md bg-muted">
                              {hit.primary_image_url ? (
                                <Image
                                  src={hit.primary_image_url}
                                  alt=""
                                  fill
                                  className="object-cover"
                                  sizes="62px"
                                  unoptimized={hit.primary_image_url.startsWith("/")}
                                />
                              ) : null}
                            </div>
                            <div className="min-w-0 flex-1">
                              <Link
                                href={`/boards/${hit.slug}`}
                                target="_blank"
                                rel="noreferrer"
                                className="line-clamp-2 text-xs font-medium text-foreground hover:underline"
                              >
                                {hit.title}
                                <ExternalLink className="ml-1 inline h-3 w-3 opacity-70" />
                              </Link>
                              {hit.assigned_board_type_other ? (
                                <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-400">
                                  Already pinned to the {hit.assigned_board_type_other} column — swap there first if
                                  intended.
                                </p>
                              ) : null}
                              {hit.hidden_from_homepage ? (
                                <p className="mt-1 text-[11px] text-muted-foreground">Hidden from homepage — unhide to use.</p>
                              ) : null}
                            </div>
                            <div className="flex shrink-0 flex-col gap-1">
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                title={hit.hidden_from_homepage ? "Show on homepage" : "Hide from homepage"}
                                disabled={homepageToggleId === hit.id}
                                onClick={() =>
                                  void onToggleHomepageHidden(hit.id, hit.hidden_from_homepage === true)
                                }
                                aria-label="Toggle homepage visibility"
                              >
                                {homepageToggleId === hit.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : hit.hidden_from_homepage ? (
                                  <Eye className="h-4 w-4" />
                                ) : (
                                  <EyeOff className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant={hit.already_assigned_here ? "secondary" : "default"}
                                disabled={
                                  Boolean(addingId) ||
                                  hit.already_assigned_here ||
                                  Boolean(hit.assigned_board_type_other) ||
                                  Boolean(hit.hidden_from_homepage)
                                }
                                onClick={() => void onAssign(slot, hit.id)}
                                className="shrink-0 text-xs"
                              >
                                {addingId === hit.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : hit.already_assigned_here ? (
                                  "Current"
                                ) : (
                                  <>
                                    <Plus className="mr-1 h-3.5 w-3.5" />
                                    Assign
                                  </>
                                )}
                              </Button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </TabsContent>
                ))}
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
