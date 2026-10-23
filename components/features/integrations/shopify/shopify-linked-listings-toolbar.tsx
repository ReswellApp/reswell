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
  shopifyFieldClass,
  shopifySearchClass,
} from "@/components/features/integrations/shopify/shopify-admin-styles"
import {
  PEER_LISTING_SECTION_LABELS,
  PEER_LISTING_SECTIONS,
  type PeerListingSection,
} from "@/lib/peer-listing-sections"
import type { ShopifyLinkedListingFilter } from "@/lib/shopify/types"
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
  section: PeerListingSection | null
  onSearchChange: (value: string) => void
  onSearchSubmit: () => void
  onSectionChange: (section: PeerListingSection | null) => void
}

export function ShopifyLinkedListingsToolbar({
  search,
  section,
  onSearchChange,
  onSearchSubmit,
  onSectionChange,
}: ShopifyLinkedListingsToolbarProps) {
  return (
    <>
      <form
        className="relative w-full min-w-0 md:w-auto md:min-w-[14rem] md:flex-1"
        onSubmit={(event) => {
          event.preventDefault()
          onSearchSubmit()
        }}
      >
        <Search
          className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a8a8a]"
          aria-hidden
        />
        <Input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search and filter"
          aria-label="Search linked listings"
          className={cn(shopifySearchClass, "w-full min-w-0 pl-8")}
        />
      </form>
      <Select
        value={section ?? "all"}
        onValueChange={(value) =>
          onSectionChange(value === "all" ? null : (value as PeerListingSection))
        }
      >
        <SelectTrigger
          className={cn(shopifyFieldClass, "w-full shrink-0 md:w-44")}
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
    </>
  )
}
