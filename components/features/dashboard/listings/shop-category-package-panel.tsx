"use client"

import { useState } from "react"
import { ChevronDown, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { ChoiceChip } from "@/components/features/dashboard/listings/choice-chip"
import { ShopShippingDefaultCard } from "@/components/features/dashboard/listings/shop-shipping-default-card"
import { setShopCategoryPackageSizeAction } from "@/lib/actions/shopCategoryPackageSize"
import { saveShopShippingDefaultsAction } from "@/lib/actions/shopShippingDefaults"
import { PEER_LISTING_SECTION_LABELS, type PeerListingSection } from "@/lib/peer-listing-sections"
import { canQuickEditListing } from "@/lib/listing-quick-edit-access"
import { sellActionErrorMessage } from "@/lib/sell-flow/sell-submit-error"
import {
  isShopPackageSizeId,
  shopPackageCategoryOrder,
  shopPackageChipLabel,
  shopPackageSizeSummary,
  shopPackageSizesForSection,
  type ListingPackageColumns,
  type ShopCategoryPackageSizeMap,
  type ShopPackageSizeId,
} from "@/lib/shop-category-package-sizes"
import {
  shopShippingDefaultsFromDraft,
  shopShippingDefaultsToJson,
  type ShopShippingDefaults,
  type ShopShippingDraftInput,
} from "@/lib/shop-shipping-defaults"
import { cn } from "@/lib/utils"

interface ShopCategoryPackagePanelProps {
  sizes: ShopCategoryPackageSizeMap
  shippingDefaults: ShopShippingDefaults
  listings: { section: string; status: string }[]
  onApplied: (result: {
    section: string
    packageSizeId: ShopPackageSizeId
    columns: ListingPackageColumns
    sizes: ShopCategoryPackageSizeMap
  }) => void
  onShippingApplied: (groups: { ids: string[]; columns: ListingPackageColumns }[]) => void
}

function listingCountLabel(count: number): string {
  if (count === 1) return "1 listing"
  return `${count} listings`
}

function suggestedPresetId(sizes: ShopCategoryPackageSizeMap): string | null {
  if (sizes.surfboards) return sizes.surfboards
  for (const section of shopPackageCategoryOrder()) {
    const sizeId = sizes[section]
    if (sizeId) return sizeId
  }
  return null
}

function shippingToast(result: {
  defaults: ShopShippingDefaults
  updatedCount: number
  skippedBecausePackageDoesNotFit: number
}): string {
  if (!result.defaults.physicalProduct) {
    return "Shop default saved. Listings stay as they are while physical product is off."
  }
  const skipped = result.skippedBecausePackageDoesNotFit
  if (result.updatedCount === 0 && skipped === 0) return "Shop default saved."
  if (result.updatedCount === 0) {
    return skipped === 1
      ? "Shop default saved. 1 board needs a larger packed size."
      : `Shop default saved. ${skipped} boards need a larger packed size.`
  }
  const applied =
    result.updatedCount === 1 ? "applied to 1 listing" : `applied to ${result.updatedCount} listings`
  if (skipped === 0) return `Shop default saved and ${applied}.`
  return skipped === 1
    ? `Shop default saved and ${applied}. 1 board needs a larger packed size.`
    : `Shop default saved and ${applied}. ${skipped} boards need a larger packed size.`
}

export function ShopCategoryPackagePanel({
  sizes,
  shippingDefaults,
  listings,
  onApplied,
  onShippingApplied,
}: ShopCategoryPackagePanelProps) {
  const [saved, setSaved] = useState(sizes)
  const [shipping, setShipping] = useState(shippingDefaults)
  const [resetKey, setResetKey] = useState(0)
  const [savingShipping, setSavingShipping] = useState(false)
  const [savingSection, setSavingSection] = useState<string | null>(null)
  const [showIdle, setShowIdle] = useState(false)

  async function commitShipping(draft: ShopShippingDraftInput) {
    const parsed = shopShippingDefaultsFromDraft(draft)
    if (!parsed.ok) return
    const nextJson = JSON.stringify(shopShippingDefaultsToJson(parsed.defaults))
    if (nextJson === JSON.stringify(shopShippingDefaultsToJson(shipping))) return
    setSavingShipping(true)
    try {
      const result = await saveShopShippingDefaultsAction(draft)
      if ("error" in result) {
        toast.error(sellActionErrorMessage(result.error))
        setResetKey((key) => key + 1)
        return
      }
      setShipping(result.defaults)
      setResetKey((key) => key + 1)
      onShippingApplied(result.appliedGroups)
      toast.success(shippingToast(result))
    } catch {
      toast.error("Could not save your shop shipping default.")
      setResetKey((key) => key + 1)
    } finally {
      setSavingShipping(false)
    }
  }

  async function saveCategory(section: PeerListingSection, packageSizeId: ShopPackageSizeId) {
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

  const rows = shopPackageCategoryOrder()
    .filter((section) => section !== "surfboards")
    .map((section) => ({
      section,
      count: listings.filter(
        (listing) => listing.section === section && canQuickEditListing(listing.status),
      ).length,
    }))
  const active = rows.filter((row) => row.count > 0)
  const idle = rows.filter((row) => row.count === 0)
  const visible = active.length === 0 ? rows : showIdle ? [...active, ...idle] : active
  const preset = suggestedPresetId(saved)

  return (
    <ShopShippingDefaultCard
      defaults={shipping}
      suggestedPresetId={preset && isShopPackageSizeId(preset) ? preset : null}
      resetKey={resetKey}
      busy={savingShipping}
      onCommit={(draft) => void commitShipping(draft)}
      onInvalid={(message) => toast.error(message)}
    >
      <ul className="space-y-4">
        {visible.map((row) => (
          <PackageSizeRow
            key={row.section}
            section={row.section}
            count={row.count}
            value={saved[row.section]}
            busy={savingSection === row.section}
            onSelect={(sizeId) => void saveCategory(row.section, sizeId)}
          />
        ))}
      </ul>
      {active.length > 0 && idle.length > 0 ? (
        <button
          type="button"
          className="flex min-h-touch w-full items-center justify-between gap-3 text-left text-sm text-muted-foreground"
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
    </ShopShippingDefaultCard>
  )
}

function PackageSizeRow({
  section,
  count,
  value,
  busy,
  onSelect,
}: {
  section: PeerListingSection
  count: number
  value: ShopPackageSizeId | undefined
  busy: boolean
  onSelect: (sizeId: ShopPackageSizeId) => void
}) {
  const label = PEER_LISTING_SECTION_LABELS[section]
  const summary = value ? shopPackageSizeSummary(value) : "No size yet"

  return (
    <li>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-8">
        <div className="sm:w-44 sm:shrink-0">
          <p className="text-sm text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground">
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
          <div className="flex flex-wrap gap-2" role="group" aria-label={`${label} package size`}>
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
          <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{summary}</p>
        </div>
      </div>
    </li>
  )
}
