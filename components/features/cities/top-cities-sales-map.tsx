"use client"

import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import { UsaSalesFlowMap } from "@/components/features/map/sales-map-page-client"
import type { MarketplaceSalesMapPayload } from "@/lib/types/marketplace-sales-map"

type TopCitiesSalesMapProps = {
  data: MarketplaceSalesMapPayload
}

export function TopCitiesSalesMap({ data }: TopCitiesSalesMapProps) {
  return (
    <div>
      <UsaSalesFlowMap data={data} size="compact" />
      <div className="mt-1.5 flex items-center justify-center">
        <Link
          href="/map"
          className="inline-flex items-center gap-1 text-[11px] font-medium text-foreground/80 transition-colors hover:text-foreground sm:text-xs"
        >
          See the full sales map
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
    </div>
  )
}
