"use client"

import { useRouter, useSearchParams } from "next/navigation"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  PEER_LISTING_SECTIONS,
  type PeerListingSection,
} from "@/lib/peer-listing-sections"

interface BalanceSheetCategoryFilterProps {
  category: PeerListingSection | null
}

const CATEGORY_LABELS: Record<PeerListingSection, string> = {
  surfboards: "Surfboards",
  fins: "Fins",
  wetsuits: "Wetsuits",
  boardbags: "Boardbags",
  surfpacks: "Surfpacks",
  leashes: "Leashes",
  apparel: "Apparel",
  accessories: "Accessories",
  magazines: "Magazines",
  traction: "Traction",
}

export function BalanceSheetCategoryFilter({
  category,
}: BalanceSheetCategoryFilterProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function handleCategoryChange(value: string): void {
    const params = new URLSearchParams(searchParams.toString())
    params.delete("page")

    if (value === "all") {
      params.delete("category")
    } else {
      params.set("category", value)
    }

    const query = params.toString()
    router.replace(query ? `/dashboard/balance-sheet?${query}` : "/dashboard/balance-sheet")
  }

  return (
    <div className="w-full sm:w-56">
      <Select value={category ?? "all"} onValueChange={handleCategoryChange}>
        <SelectTrigger aria-label="Filter balance sheet by category">
          <SelectValue placeholder="All categories" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All categories</SelectItem>
          {PEER_LISTING_SECTIONS.map((section) => (
            <SelectItem key={section} value={section}>
              {CATEGORY_LABELS[section]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
