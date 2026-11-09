"use client"

import { useCallback, useEffect, useState } from "react"
import type { MobileMarketplaceSalesMap } from "@reswell/api-contract"
import { SalesMapPageClient } from "@/components/features/map/sales-map-page-client"
import { SalesMapPageSkeleton } from "@/components/features/map/sales-map-page-skeleton"
import { Button } from "@/components/ui/button"
import { fetchMarketplaceSalesMapClient } from "@/lib/fetch/marketplace-sales-map-client"

export function SalesMapPageLoader() {
  const [data, setData] = useState<MobileMarketplaceSalesMap | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  const reload = useCallback(() => setAttempt((value) => value + 1), [])

  useEffect(() => {
    let cancelled = false
    setData(null)
    setError(null)
    fetchMarketplaceSalesMapClient()
      .then((payload) => {
        if (!cancelled) setData(payload)
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "Unable to load the sales map")
        }
      })
    return () => {
      cancelled = true
    }
  }, [attempt])

  if (error) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-16">
        <p className="max-w-md text-center text-sm text-[#5c6b89]">{error}</p>
        <Button type="button" variant="outline" className="rounded-full px-6" onClick={reload}>
          Try again
        </Button>
      </main>
    )
  }

  if (!data) {
    return <SalesMapPageSkeleton />
  }

  return <SalesMapPageClient data={data} />
}
