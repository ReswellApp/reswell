"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SellPhotoIdentifyListing } from "@/components/features/sell/sell-photo-identify-listing"
import { SellPhotoIdentifyResults } from "@/components/features/sell/sell-photo-identify-results"
import { SellPhotoIdentifyShot } from "@/components/features/sell/sell-photo-identify-shot"
import { LISTING_IMAGE_MAX_ORIGINAL_BYTES } from "@/lib/listing-image-pipeline"
import {
  sellCatalogHandoffFromRow,
  writeSellCatalogHandoff,
} from "@/lib/sell-flow/catalog-handoff"
import { prepareSellPhotoMatchFile } from "@/lib/sell-flow/prepare-sell-photo-match-file"
import { writeSellPhotoMatchDimensions } from "@/lib/sell-flow/sell-photo-match-dimensions"
import { setSellEntryPoint } from "@/lib/sell-flow/sell-entry-point"
import {
  SELL_PHOTO_MATCH_SHOTS,
  type SellPhotoMatchShot,
} from "@/lib/sell-flow/sell-photo-match"
import type { SellPhotoMatchResponse } from "@/lib/types/sell-photo-match"
import {
  sellCatalogSearchCategorySellPath,
  sellCatalogSearchRowCategory,
  type SellCatalogSearchResultRow,
} from "@/lib/types/sell-catalog-search"
import { cn } from "@/lib/utils"

type ShotFile = { file: File; url: string }

function isImageFile(file: File): boolean {
  return file.type.startsWith("image/") || /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)
}

export function SellPhotoIdentify({ className }: { className?: string }) {
  const router = useRouter()
  const [shots, setShots] = React.useState<Partial<Record<SellPhotoMatchShot, ShotFile>>>({})
  const [phase, setPhase] = React.useState<"idle" | "working" | "done">("idle")
  const [error, setError] = React.useState<string | null>(null)
  const [result, setResult] = React.useState<SellPhotoMatchResponse | null>(null)
  const shotsRef = React.useRef(shots)
  shotsRef.current = shots

  React.useEffect(() => {
    return () => {
      for (const shot of Object.values(shotsRef.current)) {
        if (shot) URL.revokeObjectURL(shot.url)
      }
    }
  }, [])

  const onFile = React.useCallback(async (shot: SellPhotoMatchShot, file: File) => {
    setError(null)
    if (!isImageFile(file)) {
      setError("Choose a photo of the board.")
      return
    }
    if (file.size > LISTING_IMAGE_MAX_ORIGINAL_BYTES) {
      setError("That photo is too large. Try a closer crop.")
      return
    }
    try {
      const prepared = await prepareSellPhotoMatchFile(file)
      const url = URL.createObjectURL(prepared)
      setShots((current) => {
        const previous = current[shot]
        if (previous) URL.revokeObjectURL(previous.url)
        return { ...current, [shot]: { file: prepared, url } }
      })
      setResult(null)
      setPhase("idle")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not prepare that photo.")
    }
  }, [])

  const ready = SELL_PHOTO_MATCH_SHOTS.every((shot) => shots[shot])
  const busy = phase === "working"

  const scan = async () => {
    if (!ready || busy) return
    setError(null)
    setResult(null)
    setPhase("working")
    try {
      const body = new FormData()
      for (const shot of SELL_PHOTO_MATCH_SHOTS) {
        const picked = shots[shot]
        if (!picked) throw new Error("Add the top, bottom, and dimensions photos.")
        body.set(shot, picked.file)
      }
      const res = await fetch("/api/sell/photo-match", {
        method: "POST",
        body,
        headers: { Accept: "application/json" },
      })
      const payload = (await res.json()) as { data?: SellPhotoMatchResponse; error?: string }
      if (!res.ok || !payload.data) {
        throw new Error(payload.error ?? "Could not scan those photos. Please try again.")
      }
      setResult(payload.data)
      setPhase("done")
    } catch (err) {
      setPhase("idle")
      setError(err instanceof Error ? err.message : "Could not scan those photos. Please try again.")
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
    <section
      className={cn("rounded-2xl border border-dashed border-border bg-muted/30 p-4 sm:p-5", className)}
      aria-label="Identify a surfboard from three photos"
    >
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Admin
      </p>
      <h2 className="mt-1 font-headline text-lg font-semibold tracking-tight text-foreground">
        Identify a board from photos
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Three photos of one surfboard: the top, the bottom, and a close-up of the dimensions. We’ll match the brand and model in the catalog. Only admins can see this.
      </p>

      <div className="mt-4 space-y-2">
        {SELL_PHOTO_MATCH_SHOTS.map((shot) => (
          <SellPhotoIdentifyShot
            key={shot}
            shot={shot}
            previewUrl={shots[shot]?.url ?? null}
            disabled={busy}
            onFile={(nextShot, file) => void onFile(nextShot, file)}
          />
        ))}
      </div>

      <Button type="button" className="mt-4" disabled={!ready || busy} onClick={() => void scan()}>
        {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
        {busy ? "Reading the photos…" : "Match to catalog"}
      </Button>

      <p
        className={cn(
          "mt-3 min-h-5 text-sm",
          error && !busy ? "text-destructive" : "text-muted-foreground",
        )}
        aria-live="polite"
      >
        {busy ? "Reading the top, bottom, and dimensions…" : error}
      </p>

      {result ? <SellPhotoIdentifyResults result={result} onSelect={chooseMatch} /> : null}
      <SellPhotoIdentifyListing />
    </section>
  )
}
