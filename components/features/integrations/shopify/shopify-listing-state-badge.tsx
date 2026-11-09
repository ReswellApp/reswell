import { cn } from "@/lib/utils"
import type { ShopifyLinkedListingState } from "@/lib/shopify/types"

const STATE_COPY: Record<
  ShopifyLinkedListingState,
  { label: string; description: string; className: string }
> = {
  live: {
    label: "Live",
    description: "Active on Reswell and in stock in Shopify.",
    className:
      "bg-[#affebf] text-[#014b40] dark:bg-emerald-950 dark:text-emerald-300",
  },
  out_of_stock: {
    label: "Out of stock",
    description: "Hidden on Reswell until Shopify has stock again.",
    className: "bg-[#e3e3e3] text-[#616161] dark:bg-muted dark:text-muted-foreground",
  },
  not_active_in_shopify: {
    label: "Draft in Shopify",
    description: "The Shopify product is draft or archived, so Reswell hides it.",
    className: "bg-[#ffd79d] text-[#5c4813] dark:bg-amber-950 dark:text-amber-200",
  },
  deleted_in_shopify: {
    label: "Deleted in Shopify",
    description: "The Shopify product or variant was deleted. Reswell removed the listing.",
    className: "bg-[#e3e3e3] text-[#616161] dark:bg-muted dark:text-muted-foreground",
  },
  needs_removal: {
    label: "Deleted in Shopify · still live",
    description:
      "Shopify no longer has this variant. Reswell is removing it; Sync now removes it immediately.",
    className: "bg-[#fed3d1] text-[#d72c0d] dark:bg-red-950 dark:text-red-300",
  },
  unpublished: {
    label: "Unpublished",
    description: "You unpublished this product. It stays linked so you can publish it again.",
    className: "bg-[#e3e3e3] text-[#616161] dark:bg-muted dark:text-muted-foreground",
  },
  error: {
    label: "Sync error",
    description: "The last sync failed. Resync to try again.",
    className: "bg-[#fed3d1] text-[#d72c0d] dark:bg-red-950 dark:text-red-300",
  },
}

export function shopifyListingStateDescription(
  state: ShopifyLinkedListingState,
): string {
  return STATE_COPY[state].description
}

interface ShopifyListingStateBadgeProps {
  state: ShopifyLinkedListingState
  className?: string
}

export function ShopifyListingStateBadge({
  state,
  className,
}: ShopifyListingStateBadgeProps) {
  const copy = STATE_COPY[state]
  return (
    <span
      title={copy.description}
      className={cn(
        "inline-flex shrink-0 items-center rounded-lg px-2 py-0.5 text-[12px] font-medium leading-4",
        copy.className,
        className,
      )}
    >
      {copy.label}
    </span>
  )
}
