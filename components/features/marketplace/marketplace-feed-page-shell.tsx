"use client"

import { Suspense, useCallback, type ReactNode } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  marketplaceFeedHref,
  parseMarketplaceFeedTab,
  type MarketplaceFeedTab,
} from "@/lib/marketplace-feed-tab"

const TAB_COPY: Record<
  MarketplaceFeedTab,
  { title: string; subtitle: string }
> = {
  new: {
    title: "New listings",
    subtitle: "Every active surfboard listing on Reswell, ordered newest to oldest.",
  },
  sold: {
    title: "Sold",
    subtitle: "Surfboards that found new homes on Reswell.",
  },
  shipped: {
    title: "Shipped boards",
    subtitle: "Sold surfboards where the buyer chose shipping at checkout.",
  },
}

type MarketplaceFeedPageShellProps = {
  activeTab: MarketplaceFeedTab
  brandFilterName?: string | null
  brandUnknown?: boolean
  newListingsPanel?: ReactNode
  soldPanel?: ReactNode
  shippedPanel?: ReactNode
}

function brandScopedTitle(
  activeTab: MarketplaceFeedTab,
  brandFilterName: string | null,
  brandUnknown: boolean,
  copy: (typeof TAB_COPY)[MarketplaceFeedTab],
): string {
  if (brandUnknown && (activeTab === "sold" || activeTab === "shipped")) {
    return "Brand not found"
  }
  if (brandFilterName && activeTab === "sold") {
    return `Sold — ${brandFilterName}`
  }
  if (brandFilterName && activeTab === "shipped") {
    return `Shipped boards — ${brandFilterName}`
  }
  return copy.title
}

function brandScopedSubtitle(
  activeTab: MarketplaceFeedTab,
  brandFilterName: string | null,
  brandUnknown: boolean,
  copy: (typeof TAB_COPY)[MarketplaceFeedTab],
): string {
  if (brandUnknown && (activeTab === "sold" || activeTab === "shipped")) {
    return "That brand slug is not in our directory."
  }
  if (brandFilterName && activeTab === "sold") {
    return `Sold surfboards linked to ${brandFilterName} on Reswell.`
  }
  if (brandFilterName && activeTab === "shipped") {
    return `Shipped surfboards linked to ${brandFilterName} on Reswell.`
  }
  return copy.subtitle
}

function MarketplaceFeedTabsInner({
  activeTab,
  brandFilterName = null,
  brandUnknown = false,
  newListingsPanel,
  soldPanel,
  shippedPanel,
}: MarketplaceFeedPageShellProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const brandSlug = searchParams.get("brandSlug")

  const onValueChange = useCallback(
    (next: string) => {
      const tab = parseMarketplaceFeedTab(next)
      const href = marketplaceFeedHref(tab, {
        brandSlug: tab === "sold" || tab === "shipped" ? brandSlug : null,
      })
      router.replace(href, { scroll: false })
    },
    [router, brandSlug],
  )

  const copy = TAB_COPY[activeTab]
  const title = brandScopedTitle(activeTab, brandFilterName, brandUnknown, copy)
  const subtitle = brandScopedSubtitle(activeTab, brandFilterName, brandUnknown, copy)

  const activePanel =
    activeTab === "new"
      ? newListingsPanel
      : activeTab === "shipped"
        ? shippedPanel
        : soldPanel

  return (
    <>
      <section className="border-b border-border bg-background">
        <div className="container mx-auto py-8">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{title}</h1>
          <p className="mt-1 text-muted-foreground">{subtitle}</p>

          <Tabs value={activeTab} onValueChange={onValueChange} className="mt-6 w-full max-w-xl">
            <TabsList
              className={cn(
                "grid h-10 w-full grid-cols-3 rounded-full border border-border/60 bg-muted/60 p-1",
              )}
            >
              <TabsTrigger
                value="new"
                className="rounded-full text-sm font-medium data-[state=active]:bg-background data-[state=active]:font-semibold data-[state=active]:shadow-sm"
              >
                New listings
              </TabsTrigger>
              <TabsTrigger
                value="sold"
                className="rounded-full text-sm font-medium data-[state=active]:bg-background data-[state=active]:font-semibold data-[state=active]:shadow-sm"
              >
                Sold
              </TabsTrigger>
              <TabsTrigger
                value="shipped"
                className="rounded-full text-sm font-medium data-[state=active]:bg-background data-[state=active]:font-semibold data-[state=active]:shadow-sm"
              >
                Shipped boards
              </TabsTrigger>
            </TabsList>
            <TabsContent value="new" className="sr-only">
              New listings feed
            </TabsContent>
            <TabsContent value="sold" className="sr-only">
              Sold feed
            </TabsContent>
            <TabsContent value="shipped" className="sr-only">
              Shipped boards feed
            </TabsContent>
          </Tabs>
        </div>
      </section>

      <section className="container mx-auto py-6">{activePanel}</section>
    </>
  )
}

export function MarketplaceFeedPageShell(props: MarketplaceFeedPageShellProps) {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-16" aria-busy="true" aria-label="Loading feed tabs">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <MarketplaceFeedTabsInner {...props} />
    </Suspense>
  )
}
