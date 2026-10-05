"use client"

import { useState } from "react"
import { ChevronDown, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { ChoiceChip } from "@/components/features/dashboard/listings/choice-chip"
import { setShopCategoryPackageSizeAction } from "@/lib/actions/shopCategoryPackageSize"
import { PEER_LISTING_SECTION_LABELS, type PeerListingSection } from "@/lib/peer-listing-sections"
import { canQuickEditListing } from "@/lib/listing-quick-edit-access"
import { sellActionErrorMessage } from "@/lib/sell-flow/sell-submit-error"
import {
  shopPackageCategoryOrder,
  shopPackageChipLabel,
  shopPackageSizeSummary,
  shopPackageSizesForSection,
  type ListingPackageColumns,
  type ShopCategoryPackageSizeMap,
  type ShopPackageSizeId,
} from "@/lib/shop-category-package-sizes"
import { cn } from "@/lib/utils"

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

function listingCountLabel(count: number): string {
  if (count === 1) return "1 listing"
  return `${count} listings`
}

export function ShopCategoryPackagePanel({
  sizes,
  listings,
  onApplied,
}: ShopCategoryPackagePanelProps) {
  const [saved, setSaved] = useState(sizes)
  const [savingSection, setSavingSection] = useState<string | null>(null)
  const [showIdle, setShowIdle] = useState(false)

  async function save(section: PeerListingSection, packageSizeId: ShopPackageSizeId) {
    if (saved[section] === packageSizeId || savingSection === section) return
    const previous = saved[section]
    setSaved((current) => ({ ...current, [section]: packageSizeId }))
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
        packageSizeId,
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

  const rows = shopPackageCategoryOrder().map((section) => ({
    section,
    count: listings.filter(
      (listing) => listing.section === section && canQuickEditListing(listing.status),
    ).length,
  }))
  const active = rows.filter((row) => row.count > 0)
  const idle = rows.filter((row) => row.count === 0)
  const visible = active.length === 0 ? rows : showIdle ? [...active, ...idle] : active

  return (
    <section className="space-y-3" aria-labelledby="shop-package-heading">
      <div>
        <h2 id="shop-package-heading" className="text-base font-semibold text-foreground">
          Shop package sizes
        </h2>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Choose the box you ship. Open listings in that category update as soon as you pick a size.
        </p>
      </div>
      <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
        <ul>
          {visible.map((row) => (
            <PackageSizeRow
              key={row.section}
              section={row.section}
              count={row.count}
              value={saved[row.section]}
              busy={savingSection === row.section}
              quiet={row.count === 0 && active.length > 0}
              onSelect={(sizeId) => void save(row.section, sizeId)}
            />
          ))}
        </ul>
        {active.length > 0 && idle.length > 0 ? (
          <button
            type="button"
            className="flex min-h-touch w-full items-center justify-between gap-3 border-t border-border/60 px-4 text-left text-sm text-muted-foreground transition-colors hover:bg-muted/50 sm:px-5"
            aria-expanded={showIdle}
            onClick={() => setShowIdle((current) => !current)}
          >
            <span>
              {showIdle
                ? "Hide empty categories"
                : idle.length === 1
                  ? "1 category with no listings"
                  : `${idle.length} categories with no listings`}
            </span>
            <ChevronDown
              className={cn("h-4 w-4 shrink-0 transition-transform", showIdle && "rotate-180")}
              aria-hidden
            />
          </button>
        ) : null}
      </div>
    </section>
  )
}

function PackageSizeRow({
  section,
  count,
  value,
  busy,
  quiet,
  onSelect,
}: {
  section: PeerListingSection
  count: number
  value: ShopPackageSizeId | undefined
  busy: boolean
  quiet: boolean
  onSelect: (sizeId: ShopPackageSizeId) => void
}) {
  const label = PEER_LISTING_SECTION_LABELS[section]
  const summary = value ? shopPackageSizeSummary(value) : "No size yet"

  return (
    <li className={cn("border-b border-border/60 last:border-b-0", quiet && "bg-muted/30")}>
      <div className="flex flex-col gap-3 px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:gap-8 lg:py-3.5">
        <div className="flex items-baseline justify-between gap-3 lg:w-44 lg:shrink-0 lg:flex-col lg:items-start lg:gap-0.5">
          <p className="text-sm font-semibold text-foreground">{label}</p>
          <p className="text-[12px] text-muted-foreground">
            {busy ? (
              <span className="inline-flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                Saving
              </span>
            ) : (
              listingCountLabel(count)
            )}
          </p>
        </div>
        <div className="min-w-0 flex-1">
          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-label={`${label} package size`}
          >
            {shopPackageSizesForSection(section).map((sizeId) => (
              <ChoiceChip
                key={sizeId}
                selected={value === sizeId}
                disabled={busy}
                onClick={() => onSelect(sizeId)}
              >
                {shopPackageChipLabel(sizeId)}
              </ChoiceChip>
            ))}
          </div>
          <p className="mt-2 text-[12px] leading-5 text-muted-foreground">{summary}</p>
        </div>
      </div>
    </li>
  )
}
