"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { FileText } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { getSellServerDraftListingId } from "@/lib/sell-draft-local-meta"
import { loadGuestSellListingDraft, loadSellListingDraft } from "@/lib/sell-listing-draft-idb"
import {
  isPeerListingSection,
  PEER_LISTING_SECTION_LABELS,
  peerListingEditHref,
} from "@/lib/peer-listing-sections"

export type SellContinueDraftItem = {
  id: string
  href: string
  title: string
  subtitle?: string
}

function sectionLabel(section: string | null | undefined): string {
  if (isPeerListingSection(section)) return PEER_LISTING_SECTION_LABELS[section]
  return "Listing"
}

/**
 * Hub "Continue" strip — up to 3 unfinished drafts. Explicit click only
 * (never auto-resume). Guests see IDB + guest-cookie server drafts.
 */
export function SellContinueDrafts({ className }: { className?: string }) {
  const [drafts, setDrafts] = useState<SellContinueDraftItem[]>([])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const items: SellContinueDraftItem[] = []
      const seen = new Set<string>()

      const push = (item: SellContinueDraftItem) => {
        if (seen.has(item.id) || items.length >= 3) return
        seen.add(item.id)
        items.push(item)
      }

      try {
        const res = await fetch("/api/listings/draft", {
          credentials: "include",
        })
        if (res.ok) {
          const json = (await res.json()) as {
            data?: {
              drafts?: Array<{
                id: string
                title: string | null
                price: number | null
                updatedAt: string
                section?: string
              }>
            }
          }
          for (const d of json.data?.drafts ?? []) {
            const label = sectionLabel(d.section)
            const title = d.title?.trim() || `${label} draft`
            push({
              id: `server-${d.id}`,
              href: peerListingEditHref(d.section, d.id),
              title,
              subtitle:
                d.price != null && d.price > 0
                  ? `$${Math.round(d.price)} · ${label}`
                  : `In progress · ${label}`,
            })
          }
        }
      } catch {
        /* fall through to session / IDB */
      }

      const boardSessionId = getSellServerDraftListingId("surfboards")
      if (boardSessionId) {
        push({
          id: `session-board-${boardSessionId}`,
          href: `/sell/boards?edit=${encodeURIComponent(boardSessionId)}`,
          title: "Surfboard draft",
          subtitle: "Continue where you left off",
        })
      }

      const finSessionId = getSellServerDraftListingId("fins")
      if (finSessionId) {
        push({
          id: `session-fin-${finSessionId}`,
          href: `/sell/fins?edit=${encodeURIComponent(finSessionId)}`,
          title: "Fins draft",
          subtitle: "Continue where you left off",
        })
      }

      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      const boardIdb = user?.id
        ? await loadSellListingDraft(user.id, "board")
        : await loadGuestSellListingDraft("board")
      if (boardIdb) {
        const fd = boardIdb.formData
        const length = typeof fd.boardLength === "string" ? fd.boardLength.trim() : ""
        const brand = typeof fd.brand === "string" ? fd.brand.trim() : ""
        const label = [length, brand].filter(Boolean).join(" ") || "Surfboard draft"
        push({
          id: "idb-board",
          href: "/sell/boards",
          title: label,
          subtitle: "On this device",
        })
      }

      const finIdb = user?.id
        ? await loadSellListingDraft(user.id, "fins")
        : await loadGuestSellListingDraft("fins")
      if (finIdb) {
        push({
          id: "idb-fins",
          href: "/sell/fins",
          title: "Fins draft",
          subtitle: "On this device",
        })
      }

      if (!cancelled) setDrafts(items.slice(0, 3))
    })()

    return () => {
      cancelled = true
    }
  }, [])

  if (drafts.length === 0) return null

  return (
    <section className={cn("space-y-3 border-t border-border/50 pt-8", className)} aria-label="Continue listing">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold tracking-tight text-foreground">Your drafts</h2>
        {drafts.length >= 3 ? (
          <Link
            href="/dashboard/listings"
            className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            See all
          </Link>
        ) : null}
      </div>
      <ul className="flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {drafts.map((d) => (
          <li key={d.id} className="shrink-0">
            <Link
              href={d.href}
              className="flex aspect-square w-[6.25rem] flex-col items-center justify-center gap-1.5 rounded-xl border border-border/80 bg-background px-2 py-2.5 text-center transition-colors hover:border-foreground/20 hover:bg-muted/30 sm:w-28"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
                <FileText className="h-3.5 w-3.5" aria-hidden />
              </span>
              <span className="min-w-0 w-full">
                <span className="block truncate text-xs font-medium text-foreground sm:text-sm">
                  {d.title}
                </span>
                {d.subtitle ? (
                  <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                    {d.subtitle}
                  </span>
                ) : null}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
