"use client"

import { useState } from "react"
import { toast } from "sonner"
import { ShopShippingDefaultCard } from "@/components/features/dashboard/listings/shop-shipping-default-card"
import { saveShopShippingDefaultsAction } from "@/lib/actions/shopShippingDefaults"
import { sellActionErrorMessage } from "@/lib/sell-flow/sell-submit-error"
import type { ListingPackageColumns } from "@/lib/shop-category-package-sizes"
import {
  shopShippingDefaultsFromDraft,
  shopShippingDefaultsToJson,
  type ShopShippingDefaults,
  type ShopShippingDraftInput,
} from "@/lib/shop-shipping-defaults"

interface ShopCategoryPackagePanelProps {
  shippingDefaults: ShopShippingDefaults
  onShippingApplied: (groups: { ids: string[]; columns: ListingPackageColumns }[]) => void
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
  shippingDefaults,
  onShippingApplied,
}: ShopCategoryPackagePanelProps) {
  const [shipping, setShipping] = useState(shippingDefaults)
  const [resetKey, setResetKey] = useState(0)
  const [savingShipping, setSavingShipping] = useState(false)

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

  return (
    <ShopShippingDefaultCard
      defaults={shipping}
      resetKey={resetKey}
      busy={savingShipping}
      onCommit={(draft) => void commitShipping(draft)}
      onInvalid={(message) => toast.error(message)}
    />
  )
}
