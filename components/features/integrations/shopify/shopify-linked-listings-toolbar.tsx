"use client"

import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  PEER_LISTING_SECTION_LABELS,
  PEER_LISTING_SECTIONS,
  type PeerListingSection,
} from "@/lib/peer-listing-sections"
import {
  SHOPIFY_LINKED_LISTING_FILTERS,
  type ShopifyLinkedListingFilter,
} from "@/lib/shopify/types"
import {
  dashboardFilterSelectClass,
  dashboardSearchInputClass,
} from "@/lib/utils/dashboard-display-styles"
import { cn } from "@/lib/utils"

export const SHOPIFY_FILTER_LABELS: Record<ShopifyLinkedListingFilter, string> = {
  all: "All linked listings",
  live: "Live on Reswell",
  out_of_stock: "Out of stock",
  deleted: "Deleted in Shopify",
  unpublished: "Unpublished",
  error: "Sync errors",
}

interface ShopifyLinkedListingsToolbarProps {
  search: string
  filter: ShopifyLinkedListingFilter
  section: PeerListingSection | null
  onSearchChange: (value: string) => void
  onSearchSubmit: () => void
  onFilterChange: (filter: ShopifyLinkedListingFilter) => void
  onSectionChange: (section: PeerListingSection | null) => void
}

export function ShopifyLinkedListingsToolbar({
  search,
  filter,
  section,
  onSearchChange,
  onSearchSubmit,
  onFilterChange,
  onSectionChange,
}: ShopifyLinkedListingsToolbarProps) {
  return (
    <div className="flex flex-col gap-2 lg:flex-row">
      <form
        className="relative flex-1"
        onSubmit={(event) => {
          event.preventDefault()
          onSearchSubmit()
        }}
      >
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search linked listings by title"
          aria-label="Search linked listings"
          className={dashboardSearchInputClass}
        />
      </form>
      <Select
        value={filter}
        onValueChange={(value) => onFilterChange(value as ShopifyLinkedListingFilter)}
      >
        <SelectTrigger className={dashboardFilterSelectClass} aria-label="Status filter">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SHOPIFY_LINKED_LISTING_FILTERS.map((value) => (
            <SelectItem key={value} value={value}>
              {SHOPIFY_FILTER_LABELS[value]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={section ?? "all"}
        onValueChange={(value) =>
          onSectionChange(value === "all" ? null : (value as PeerListingSection))
        }
      >
        <SelectTrigger
          className={cn(dashboardFilterSelectClass, "sm:w-[180px]")}
          aria-label="Section filter"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All sections</SelectItem>
          {PEER_LISTING_SECTIONS.map((value) => (
            <SelectItem key={value} value={value}>
              {PEER_LISTING_SECTION_LABELS[value]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
