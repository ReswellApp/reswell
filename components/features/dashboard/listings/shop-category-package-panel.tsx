"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { setShopCategoryPackageSizeAction } from "@/lib/actions/shopCategoryPackageSize"
import { PEER_LISTING_SECTION_LABELS, type PeerListingSection } from "@/lib/peer-listing-sections"
import { canQuickEditListing } from "@/lib/listing-quick-edit-access"
import { sellActionErrorMessage } from "@/lib/sell-flow/sell-submit-error"
import {
  shopPackageCategoryOrder,
  shopPackageSizeLabel,
  shopPackageSizeSummary,
  shopPackageSizesForSection,
  type ListingPackageColumns,
  type ShopCategoryPackageSizeMap,
  type ShopPackageSizeId,
} from "@/lib/shop-category-package-sizes"

interface ShopCategoryPackagePanelProps {
  sizes: ShopCategoryPackageSizeMap
  listings: { section: string; status: string }[]
  onApplied: (result: {
    section: string
    packageSizeId: ShopPackageSizeId
    columns: ListingPackageColumns
    sizes: ShopCategoryPackageSizeMap
  }) => void
}

export function ShopCategoryPackagePanel({
  sizes,
  listings,
  onApplied,
}: ShopCategoryPackagePanelProps) {
  const [saved, setSaved] = useState(sizes)
  const [savingSection, setSavingSection] = useState<string | null>(null)

  async function save(section: PeerListingSection, packageSizeId: string) {
    const previous = saved[section]
    setSaved((current) => ({ ...current, [section]: packageSizeId as ShopPackageSizeId }))
    setSavingSection(section)
    try {
      const result = await setShopCategoryPackageSizeAction({ section, packageSizeId })
      if ("error" in result) {
        setSaved((current) => ({ ...current, [section]: previous }))
        toast.error(sellActionErrorMessage(result.error))
        return
      }
      setSaved(result.sizes)
      onApplied({
        section,
        packageSizeId: packageSizeId as ShopPackageSizeId,
        columns: result.columns,
        sizes: result.sizes,
      })
      const label = PEER_LISTING_SECTION_LABELS[section]
      toast.success(
        result.updatedCount === 0
          ? `${label} package size saved for new listings.`
          : result.updatedCount === 1
            ? `${label} package size saved and applied to 1 listing.`
            : `${label} package size saved and applied to ${result.updatedCount} listings.`,
      )
    } catch {
      setSaved((current) => ({ ...current, [section]: previous }))
      toast.error("Could not save this package size.")
    } finally {
      setSavingSection(null)
    }
  }

  return (
    <section className="space-y-3" aria-labelledby="shop-package-heading">
      <div>
        <h2 id="shop-package-heading" className="text-base font-semibold text-foreground">
          Shop package sizes
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick the box you ship for each category. Saving updates your open listings in that category.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {shopPackageCategoryOrder().map((section) => {
          const count = listings.filter(
            (listing) => listing.section === section && canQuickEditListing(listing.status),
          ).length
          const value = saved[section]
          const busy = savingSection === section
          return (
            <div
              key={section}
              className="rounded-2xl border border-border/70 bg-card px-4 py-3 shadow-sm"
            >
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-foreground">
                  {PEER_LISTING_SECTION_LABELS[section]}
                </p>
                <p className="text-[12px] text-muted-foreground">
                  {busy ? (
                    <span className="inline-flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                      Saving
                    </span>
                  ) : count === 1 ? (
                    "1 open listing"
                  ) : (
                    `${count} open listings`
                  )}
                </p>
              </div>
              <Select
                value={value}
                onValueChange={(next) => void save(section, next)}
                disabled={busy}
              >
                <SelectTrigger aria-label={`${PEER_LISTING_SECTION_LABELS[section]} package size`}>
                  <SelectValue placeholder="Choose a package size" />
                </SelectTrigger>
                <SelectContent>
                  {shopPackageSizesForSection(section).map((sizeId) => (
                    <SelectItem key={sizeId} value={sizeId}>
                      {shopPackageSizeLabel(sizeId)} — {shopPackageSizeSummary(sizeId)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )
        })}
      </div>
    </section>
  )
}
