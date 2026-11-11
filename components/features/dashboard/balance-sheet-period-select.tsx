"use client"

import { useRouter, useSearchParams } from "next/navigation"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { BalanceSheetPeriod } from "@/lib/validations/seller-balance-sheet"

interface BalanceSheetPeriodSelectProps {
  period: BalanceSheetPeriod
}

export function BalanceSheetPeriodSelect({ period }: BalanceSheetPeriodSelectProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function handlePeriodChange(value: string): void {
    const params = new URLSearchParams(searchParams.toString())
    params.delete("page")

    if (value === "all") {
      params.delete("period")
    } else {
      params.set("period", value)
    }

    const query = params.toString()
    router.replace(query ? `/dashboard/balance-sheet?${query}` : "/dashboard/balance-sheet")
  }

  return (
    <div className="w-full sm:w-48">
      <Select value={period} onValueChange={handlePeriodChange}>
        <SelectTrigger aria-label="P&L period">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="month">This month</SelectItem>
          <SelectItem value="3m">Last 3 months</SelectItem>
          <SelectItem value="all">All time</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
