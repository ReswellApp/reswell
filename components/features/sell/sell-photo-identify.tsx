"use client"

import * as React from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Camera, ImagePlus, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SellPhotoIdentifyResults } from "@/components/features/sell/sell-photo-identify-results"
import { LISTING_IMAGE_MAX_ORIGINAL_BYTES } from "@/lib/listing-image-pipeline"
import {
  sellCatalogHandoffFromRow,
  writeSellCatalogHandoff,
} from "@/lib/sell-flow/catalog-handoff"
import { prepareSellPhotoMatchFile } from "@/lib/sell-flow/prepare-sell-photo-match-file"
import { setSellEntryPoint } from "@/lib/sell-flow/sell-entry-point"
import type { SellPhotoMatchResponse } from "@/lib/types/sell-photo-match"
import {
  sellCatalogSearchCategorySellPath,
  sellCatalogSearchRowCategory,
  type SellCatalogSearchResultRow,
} from "@/lib/types/sell-catalog-search"
import { cn } from "@/lib/utils"

export function SellPhotoIdentify({ className }: { className?: string }) {
  const router = useRouter()
  const cameraRef = React.useRef<HTMLInputElement>(null)
  const libraryRef = React.useRef<HTMLInputElement>(null)
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null)
  const [phase, setPhase] = React.useState<"idle" | "working" | "done">("idle")
  const [error, setError] = React.useState<string | null>(null)
  const [result, setResult] = React.useState<SellPhotoMatchResponse | null>(null)

  React.useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const scanFile = React.useCallback(async (file: File) => {
    setError(null)
    setResult(null)
    if (!file.type.startsWith("image/") && !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)) {
      setError("Choose a photo of a surfboard or fin.")
      return
    }
    if (file.size > LISTING_IMAGE_MAX_ORIGINAL_BYTES) {
      setError("That photo is too large. Try a closer crop.")
      return
    }

    setPhase("working")
    try {
      const prepared = await prepareSellPhotoMatchFile(file)
      setPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current)
        return URL.createObjectURL(prepared)
      })

      const body = new FormData()
      body.set("photo", prepared)
      const res = await fetch("/api/sell/photo-match", {
        method: "POST",
        body,
        headers: { Accept: "application/json" },
      })
      const payload = (await res.json()) as { data?: SellPhotoMatchResponse; error?: string }
      if (!res.ok || !payload.data) {
        throw new Error(payload.error ?? "Could not scan that photo. Please try again.")
      }
      setResult(payload.data)
      setPhase("done")
    } catch (err) {
      setPhase("idle")
      setError(err instanceof Error ? err.message : "Could not scan that photo. Please try again.")
    }
  }, [])

  const onPick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (file) void scanFile(file)
  }

  const chooseMatch = (row: SellCatalogSearchResultRow) => {
    setSellEntryPoint("catalog_handoff")
    writeSellCatalogHandoff(sellCatalogHandoffFromRow(row))
    router.push(sellCatalogSearchCategorySellPath(sellCatalogSearchRowCategory(row)))
  }

  const busy = phase === "working"

  return (
    <section
      className={cn("rounded-2xl border border-dashed border-border bg-muted/30 p-4 sm:p-5", className)}
      aria-label="Identify a surfboard or fin from a photo"
    >
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Admin
      </p>
      <h2 className="mt-1 font-headline text-lg font-semibold tracking-tight text-foreground">
        Identify from a photo
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Photograph a surfboard or fin. We’ll read the logo and match it to the catalog. Only admins see this.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={busy} onClick={() => cameraRef.current?.click()}>
          {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Camera aria-hidden />}
          Take photo
        </Button>
        <Button type="button" variant="outline" disabled={busy} onClick={() => libraryRef.current?.click()}>
          <ImagePlus aria-hidden />
          Upload
        </Button>
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={onPick}
        />
        <input
          ref={libraryRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          className="sr-only"
          onChange={onPick}
        />
      </div>

      {previewUrl ? (
        <div className="relative mt-4 aspect-[4/3] max-h-64 overflow-hidden rounded-xl bg-muted">
          <Image
            src={previewUrl}
            alt="Photo being identified"
            fill
            unoptimized
            className="object-contain"
            sizes="(max-width: 640px) 100vw, 640px"
          />
        </div>
      ) : null}

      <p
        className={cn(
          "mt-3 min-h-5 text-sm",
          error && !busy ? "text-destructive" : "text-muted-foreground",
        )}
        aria-live="polite"
      >
        {busy ? "Reading the photo…" : error}
      </p>

      {result ? <SellPhotoIdentifyResults result={result} onSelect={chooseMatch} /> : null}
    </section>
  )
}
