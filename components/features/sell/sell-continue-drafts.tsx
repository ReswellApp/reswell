"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight, FileText } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { getSellServerDraftListingId } from "@/lib/sell-draft-local-meta"
import { loadGuestSellListingDraft, loadSellListingDraft } from "@/lib/sell-listing-draft-idb"

export type SellContinueDraftItem = {
  id: string
  href: string
  title: string
  subtitle?: string
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
        const res = await fetch("/api/listings/draft?section=surfboards", {
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
              }>
            }
          }
          for (const d of json.data?.drafts ?? []) {
            const title = d.title?.trim() || "Surfboard draft"
            push({
              id: `server-board-${d.id}`,
              href: `/sell/boards?edit=${encodeURIComponent(d.id)}`,
              title,
              subtitle: d.price != null && d.price > 0 ? `$${Math.round(d.price)}` : "In progress",
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
          href: "/sell/quick",
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
    <section className={cn("space-y-3", className)} aria-label="Continue listing">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">Continue</h2>
        {drafts.length >= 3 ? (
          <Link
            href="/sell/boards"
            className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            See all
          </Link>
        ) : null}
      </div>
      <ul className="space-y-2">
        {drafts.map((d) => (
          <li key={d.id}>
            <Link
              href={d.href}
              className="flex items-center gap-3 rounded-2xl border border-border/80 bg-background px-4 py-3 shadow-sm transition-colors hover:border-foreground/20 hover:bg-muted/30"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
                <FileText className="h-4 w-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">
                  {d.title}
                </span>
                {d.subtitle ? (
                  <span className="block truncate text-xs text-muted-foreground">
                    {d.subtitle}
                  </span>
                ) : null}
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
