import type {
  MobileMarketplaceFeedStats,
  MobileMarketplaceFeedTab,
} from "@reswell/api-contract"

export const MOBILE_MARKETPLACE_FEED_COPY: Record<
  MobileMarketplaceFeedTab,
  { title: string; subtitle: string }
> = {
  new: {
    title: "New listings",
    subtitle: "Every active surfboard listing on Reswell, ordered newest to oldest.",
  },
  sold: {
    title: "Sold",
    subtitle: "Surfboards and fins that found new homes on Reswell.",
  },
  shipped: {
    title: "Shipped boards",
    subtitle: "Sold surfboards where the buyer chose shipping at checkout.",
  },
}

function countLabel(count: number): string {
  return Math.max(0, Math.trunc(count)).toLocaleString("en-US")
}

/** Headline under the feed title. Same counts the website shows on `/sold`. */
export function marketplaceFeedStats(
  tab: MobileMarketplaceFeedTab,
  count: number,
  gmvLabel: string | null,
): MobileMarketplaceFeedStats {
  const safeCount = Math.max(0, Math.trunc(count))
  const formatted = countLabel(safeCount)
  if (tab === "sold") {
    const gmv = gmvLabel?.trim() || "$0"
    return {
      count: safeCount,
      gmv_label: gmv,
      caption: `${formatted} ${safeCount === 1 ? "item" : "items"} sold on Reswell · ${gmv} in sales`,
    }
  }
  if (tab === "shipped") {
    return {
      count: safeCount,
      gmv_label: null,
      caption: `${formatted} shipped ${safeCount === 1 ? "board" : "boards"} on Reswell`,
    }
  }
  return {
    count: safeCount,
    gmv_label: null,
    caption: `${formatted} active ${safeCount === 1 ? "listing" : "listings"} on Reswell`,
  }
}
