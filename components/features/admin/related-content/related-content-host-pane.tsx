"use client"

import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { RelatedContentThumb } from "@/components/features/admin/related-content/related-content-thumb"
import type {
  ListingSearchHit,
  RelatedContentHostSummary,
} from "@/components/features/admin/related-content/related-content-admin-types"
import { cn } from "@/lib/utils"

export function RelatedContentHostPane({
  hosts,
  loadingHosts,
  selectedId,
  onSelect,
  hostQuery,
  onHostQueryChange,
  hostHits,
  searchingHosts,
}: {
  hosts: RelatedContentHostSummary[]
  loadingHosts: boolean
  selectedId: string | null
  onSelect: (listingId: string) => void
  hostQuery: string
  onHostQueryChange: (value: string) => void
  hostHits: ListingSearchHit[]
  searchingHosts: boolean
}) {
  return (
    <section className="space-y-3 rounded-lg border border-border p-4">
      <h2 className="text-sm font-semibold text-foreground">Listing</h2>
      <p className="text-xs text-muted-foreground">
        Select a listing, then attach blogs or other listings to its page.
      </p>
      <Input
        value={hostQuery}
        onChange={(e) => onHostQueryChange(e.target.value)}
        placeholder="Search listings by title or slug…"
        aria-label="Search listings to curate"
      />
      {searchingHosts && hostHits.length === 0 ? (
        <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading listings…
        </div>
      ) : hostHits.length === 0 ? (
        <p className="py-3 text-sm text-muted-foreground">
          {hostQuery.trim() ? "No listings match that search." : "No listings found."}
        </p>
      ) : (
        <ul className="max-h-[28rem] space-y-1 overflow-y-auto">
          {hostHits.map((hit) => (
            <li key={hit.id}>
              <button
                type="button"
                onClick={() => onSelect(hit.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg border p-2 text-left",
                  selectedId === hit.id ? "border-foreground/40 bg-muted/60" : "border-border",
                )}
              >
                <RelatedContentThumb src={hit.primary_image_url} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{hit.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {hit.section ?? "listing"}
                    {hit.status ? ` · ${hit.status}` : ""}
                    {hit.hidden_from_site ? " · hidden" : ""}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-2">
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Listings with related content
        </h3>
        {loadingHosts ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : hosts.length === 0 ? (
          <p className="text-sm text-muted-foreground">None yet — pick a listing above to start.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {hosts.map((host) => (
              <Button
                key={host.id}
                type="button"
                variant={selectedId === host.id ? "default" : "outline"}
                size="sm"
                className="h-auto justify-start py-2"
                onClick={() => onSelect(host.id)}
              >
                <span className="min-w-0 flex-1 truncate text-left">{host.title}</span>
                <Badge variant="secondary" className="ml-2 shrink-0">
                  {host.item_count}
                </Badge>
              </Button>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
