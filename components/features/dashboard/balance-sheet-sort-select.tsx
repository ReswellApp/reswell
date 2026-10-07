"use client"

import { useRouter, useSearchParams } from "next/navigation"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { BalanceSheetSort } from "@/lib/validations/seller-balance-sheet"

interface BalanceSheetSortSelectProps {
  sort: BalanceSheetSort
}

export function BalanceSheetSortSelect({ sort }: BalanceSheetSortSelectProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function handleSortChange(value: string): void {
    const params = new URLSearchParams(searchParams.toString())
    params.delete("page")

    if (value === "missing-paid") {
      params.set("sort", value)
    } else {
      params.delete("sort")
    }

    const query = params.toString()
    router.replace(query ? `/dashboard/balance-sheet?${query}` : "/dashboard/balance-sheet")
  }

  return (
    <div className="w-full sm:w-56">
      <Select value={sort} onValueChange={handleSortChange}>
        <SelectTrigger aria-label="Sort balance sheet">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="recent">Newest</SelectItem>
          <SelectItem value="missing-paid">Missing paid price</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
