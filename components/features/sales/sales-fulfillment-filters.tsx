"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { SalesListFilter } from "@/lib/sale-fulfillment-filters"

const FILTER_LABEL: Record<SalesListFilter, string> = {
  all: "All",
  "pending-shipment": "Pending shipment",
  "pending-pickup": "Pending pickup",
}

export function SalesFulfillmentFilters({
  activeFilter,
  pendingShipmentCount,
  pendingPickupCount,
}: {
  activeFilter: SalesListFilter
  pendingShipmentCount: number
  pendingPickupCount: number
}) {
  const pathname = usePathname() ?? "/dashboard/sales"
  const router = useRouter()
  const searchParams = useSearchParams()

  function setFilter(next: SalesListFilter) {
    const q = new URLSearchParams(searchParams.toString())
    if (next === "all") {
      q.delete("filter")
    } else {
      q.set("filter", next)
    }
    const suffix = q.toString()
    router.replace(suffix ? `${pathname}?${suffix}` : pathname)
  }

  return (
    <Tabs value={activeFilter} onValueChange={(value) => setFilter(value as SalesListFilter)}>
      <TabsList className="h-auto w-full flex-wrap justify-start gap-1.5 p-1 sm:inline-flex sm:h-10 sm:w-auto">
        {(Object.keys(FILTER_LABEL) as SalesListFilter[]).map((key) => {
          const count =
            key === "pending-shipment"
              ? pendingShipmentCount
              : key === "pending-pickup"
                ? pendingPickupCount
                : null
          return (
            <TabsTrigger key={key} value={key} className="text-xs sm:text-sm">
              {FILTER_LABEL[key]}
              {count != null ? ` (${count})` : null}
            </TabsTrigger>
          )
        })}
      </TabsList>
    </Tabs>
  )
}
