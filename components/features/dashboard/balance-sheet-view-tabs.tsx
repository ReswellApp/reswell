"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { BalanceSheetView } from "@/lib/validations/seller-balance-sheet"

interface BalanceSheetViewTabsProps {
  view: BalanceSheetView
  activeCount: number
  soldCount: number
}

const VIEW_LABEL: Record<BalanceSheetView, string> = {
  all: "All",
  active: "Active inventory",
  sold: "Sold",
}

export function BalanceSheetViewTabs({
  view,
  activeCount,
  soldCount,
}: BalanceSheetViewTabsProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function handleViewChange(value: string): void {
    const params = new URLSearchParams(searchParams.toString())
    params.delete("page")

    if (value === "all") {
      params.delete("view")
    } else {
      params.set("view", value)
    }

    const query = params.toString()
    router.replace(query ? `/dashboard/balance-sheet?${query}` : "/dashboard/balance-sheet")
  }

  return (
    <Tabs value={view} onValueChange={handleViewChange}>
      <TabsList className="h-auto w-full flex-wrap justify-start gap-1.5 p-1 sm:inline-flex sm:h-10 sm:w-auto">
        {(Object.keys(VIEW_LABEL) as BalanceSheetView[]).map((key) => {
          const count =
            key === "active" ? activeCount : key === "sold" ? soldCount : activeCount + soldCount
          return (
            <TabsTrigger key={key} value={key} className="text-xs sm:text-sm">
              {VIEW_LABEL[key]}
              <span className="ml-1.5 tabular-nums text-muted-foreground">({count})</span>
            </TabsTrigger>
          )
        })}
      </TabsList>
    </Tabs>
  )
}
