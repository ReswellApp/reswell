"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SellCatalogImageScanCapture } from "@/components/features/sell/sell-catalog-image-scan-capture"
import { SellCatalogImageScanResults } from "@/components/features/sell/sell-catalog-image-scan-results"
import { SELL_HUB_HREF } from "@/components/features/sell/sell-type-chooser"
import type { SellCatalogImageScanResult } from "@/lib/types/sell-catalog-image-scan"
import {
  sellCatalogSearchCategorySellPath,
  sellCatalogSearchRowCategory,
  type SellCatalogSearchResultRow,
} from "@/lib/types/sell-catalog-search"
import {
  sellCatalogHandoffFromRow,
  writeSellCatalogHandoff,
} from "@/lib/sell-flow/catalog-handoff"
import { setSellEntryPoint } from "@/lib/sell-flow/sell-entry-point"

export function SellCatalogImageScan() {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [preparing, setPreparing] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<SellCatalogImageScanResult | null>(null)

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const handlePhoto = useCallback((next: File) => {
    setError(null)
    setResult(null)
    setFile(next)
  }, [])

  const handleClear = useCallback(() => {
    setFile(null)
    setResult(null)
    setError(null)
  }, [])

  const scanPhoto = useCallback(async () => {
    if (!file) return
    setScanning(true)
    setError(null)
    setPreparing(true)
    try {
      const body = new FormData()
      body.append("file", file)
      const res = await fetch("/api/sell/catalog-scan", {
        method: "POST",
        body,
        headers: { Accept: "application/json" },
      })
      const json = (await res.json()) as {
        data?: SellCatalogImageScanResult
        error?: string
      }
      if (!res.ok || !json.data) {
        throw new Error(json.error ?? "Could not match that photo.")
      }
      setResult(json.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not match that photo.")
    } finally {
      setScanning(false)
      setPreparing(false)
    }
  }, [file])

  const handleSelect = useCallback(
    (row: SellCatalogSearchResultRow) => {
      setSellEntryPoint("catalog_handoff")
      writeSellCatalogHandoff(sellCatalogHandoffFromRow(row))
      router.push(sellCatalogSearchCategorySellPath(sellCatalogSearchRowCategory(row)))
    },
    [router],
  )

  return (
    <main className="flex-1 bg-background pb-12 pt-6 sm:pt-10">
      <div className="container mx-auto max-w-2xl px-4 sm:px-6">
        <div className="space-y-6">
          <div className="space-y-2">
            <Link
              href={SELL_HUB_HREF}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Back to search
            </Link>
            <p className="text-sm text-muted-foreground">Admin only</p>
            <h1 className="font-headline text-2xl font-bold tracking-tight text-[#001A4A] sm:text-3xl">
              Scan a photo
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
              Photograph a surfboard or fin. We read the image, then match it to a
              catalog model so you can finish the listing.
            </p>
          </div>

          <SellCatalogImageScanCapture
            previewUrl={previewUrl}
            preparing={preparing}
            onPhoto={handlePhoto}
            onError={setError}
            onClear={handleClear}
          />

          {file && !result ? (
            <Button type="button" className="w-full sm:w-auto" onClick={() => void scanPhoto()} disabled={scanning}>
              {scanning ? <Loader2 className="animate-spin" aria-hidden /> : null}
              {scanning ? "Matching…" : "Find catalog matches"}
            </Button>
          ) : null}

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          {result ? (
            <SellCatalogImageScanResults result={result} onSelect={handleSelect} />
          ) : null}
        </div>
      </div>
    </main>
  )
}
