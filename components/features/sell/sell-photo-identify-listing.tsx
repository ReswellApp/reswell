"use client"

import * as React from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SellPhotoIdentifyResults } from "@/components/features/sell/sell-photo-identify-results"
import { listingFilmImageSrcFromRow } from "@/lib/listing-image-display"
import {
  sellCatalogHandoffFromRow,
  writeSellCatalogHandoff,
} from "@/lib/sell-flow/catalog-handoff"
import { writeSellPhotoMatchDimensions } from "@/lib/sell-flow/sell-photo-match-dimensions"
import { setSellEntryPoint } from "@/lib/sell-flow/sell-entry-point"
import { SELL_PHOTO_MATCH_LISTING_IMAGE_LIMIT } from "@/lib/sell-flow/sell-photo-match"
import type { SellPhotoLiveListing, SellPhotoMatchResponse } from "@/lib/types/sell-photo-match"
import {
  sellCatalogSearchCategorySellPath,
  sellCatalogSearchRowCategory,
  type SellCatalogSearchResultRow,
} from "@/lib/types/sell-catalog-search"
import { cn } from "@/lib/utils"

function savedName(listing: SellPhotoLiveListing): string {
  const parts = [listing.brand, listing.model].filter((part): part is string => Boolean(part))
  return parts.length > 0 ? parts.join(" · ") : "No brand or model saved"
}

export function SellPhotoIdentifyListing() {
  const router = useRouter()
  const [query, setQuery] = React.useState("")
  const [listings, setListings] = React.useState<SellPhotoLiveListing[]>([])
  const [searching, setSearching] = React.useState(false)
  const [selected, setSelected] = React.useState<SellPhotoLiveListing | null>(null)
  const [imageIds, setImageIds] = React.useState<string[]>([])
  const [phase, setPhase] = React.useState<"idle" | "working" | "done">("idle")
  const [error, setError] = React.useState<string | null>(null)
  const [result, setResult] = React.useState<SellPhotoMatchResponse | null>(null)
  const busy = phase === "working"

  React.useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setListings([])
      setSearching(false)
      return
    }
    const ac = new AbortController()
    const timer = window.setTimeout(() => {
      void (async () => {
        setSearching(true)
        try {
          const res = await fetch(`/api/sell/photo-match/listings?q=${encodeURIComponent(q)}`, {
            signal: ac.signal,
            headers: { Accept: "application/json" },
          })
          const payload = (await res.json()) as { data?: SellPhotoLiveListing[]; error?: string }
          if (!res.ok) throw new Error(payload.error ?? "Could not search listings.")
          setError(null)
          setListings(payload.data ?? [])
        } catch (err) {
          if (ac.signal.aborted) return
          setListings([])
          setError(err instanceof Error ? err.message : "Could not search listings.")
        } finally {
          if (!ac.signal.aborted) setSearching(false)
        }
      })()
    }, 250)
    return () => {
      ac.abort()
      window.clearTimeout(timer)
    }
  }, [query])

  const chooseListing = (listing: SellPhotoLiveListing) => {
    setSelected(listing)
    setImageIds([])
    setResult(null)
    setPhase("idle")
    setError(null)
  }

  const toggleImage = (id: string) => {
    setResult(null)
    setPhase("idle")
    setImageIds((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id)
      if (current.length >= SELL_PHOTO_MATCH_LISTING_IMAGE_LIMIT) return current
      return [...current, id]
    })
  }

  const scan = async () => {
    if (!selected || imageIds.length < 1 || busy) return
    setError(null)
    setResult(null)
    setPhase("working")
    try {
      const res = await fetch("/api/sell/photo-match/listing", {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ listingId: selected.id, imageIds }),
      })
      const payload = (await res.json()) as { data?: SellPhotoMatchResponse; error?: string }
      if (!res.ok || !payload.data) {
        throw new Error(payload.error ?? "Could not match those photos.")
      }
      setResult(payload.data)
      setPhase("done")
    } catch (err) {
      setPhase("idle")
      setError(err instanceof Error ? err.message : "Could not match those photos.")
    }
  }

  const chooseMatch = (row: SellCatalogSearchResultRow) => {
    if (!result) return
    setSellEntryPoint("catalog_handoff")
    writeSellPhotoMatchDimensions(result.observation)
    writeSellCatalogHandoff(sellCatalogHandoffFromRow(row))
    router.push(sellCatalogSearchCategorySellPath(sellCatalogSearchRowCategory(row)))
  }

  return (
    <div className="mt-6 border-t border-border pt-5">
      <h3 className="font-headline text-base font-semibold tracking-tight text-foreground">
        Match photos from a live listing
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Search an active surfboard listing and choose up to {SELL_PHOTO_MATCH_LISTING_IMAGE_LIMIT} of its photos. The match uses those photos only. The brand and model saved on the listing are not sent to the reader.
      </p>

      <Input
        className="mt-3"
        value={query}
        disabled={busy}
        placeholder="Search title, brand, or model"
        onChange={(event) => {
          setQuery(event.target.value)
          setError(null)
        }}
      />

      {searching ? <p className="mt-2 text-sm text-muted-foreground">Searching live listings…</p> : null}
      {!searching && query.trim().length >= 2 && listings.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">No active surfboard listings matched.</p>
      ) : null}

      {listings.length > 0 ? (
        <ul className="mt-2 overflow-hidden rounded-xl border border-border bg-background">
          {listings.map((listing) => (
            <li key={listing.id} className="border-b border-border last:border-b-0">
              <button
                type="button"
                className={cn(
                  "flex w-full items-center px-4 py-2.5 text-left hover:bg-muted/70",
                  selected?.id === listing.id && "bg-muted/70",
                )}
                disabled={busy}
                onClick={() => chooseListing(listing)}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-foreground">{listing.title}</span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    Saved as {savedName(listing)} · {listing.images.length} photos
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {selected ? (
        <>
          <p className="mt-4 text-sm text-foreground">
            Saved on this listing: {savedName(selected)}
          </p>
          <ul className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {selected.images.map((image, index) => {
              const src = listingFilmImageSrcFromRow({ url: image.url })
              const on = imageIds.includes(image.id)
              return (
                <li key={image.id}>
                  <button
                    type="button"
                    className={cn(
                      "relative aspect-square w-full overflow-hidden rounded-lg border bg-muted",
                      on ? "border-foreground ring-2 ring-foreground" : "border-border",
                    )}
                    disabled={busy || (!on && imageIds.length >= SELL_PHOTO_MATCH_LISTING_IMAGE_LIMIT)}
                    aria-pressed={on}
                    onClick={() => toggleImage(image.id)}
                  >
                    {src ? (
                      <Image
                        src={src}
                        alt={`${selected.title} photo ${index + 1}`}
                        fill
                        sizes="120px"
                        className="object-cover"
                        unoptimized
                      />
                    ) : null}
                  </button>
                </li>
              )
            })}
          </ul>
          <Button
            type="button"
            className="mt-3"
            disabled={imageIds.length < 1 || busy}
            onClick={() => void scan()}
          >
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {busy ? "Reading the photos…" : "Match selected photos"}
          </Button>
        </>
      ) : null}

      <p
        className={cn("mt-3 min-h-5 text-sm", error && !busy ? "text-destructive" : "text-muted-foreground")}
        aria-live="polite"
      >
        {busy ? "Reading the listing photos…" : error}
      </p>
      {result ? <SellPhotoIdentifyResults result={result} onSelect={chooseMatch} /> : null}
    </div>
  )
}
