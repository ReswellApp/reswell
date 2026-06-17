"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SellerOfferResponseDialog, type OfferRowLite } from "@/components/features/messages/seller-offer-response-dialog"
import { BuyerCounterOfferDialog } from "@/components/features/offers/buyer-counter-offer-dialog"
import { OfferRow } from "@/components/features/offers/offer-row"
import { OffersEmptyState } from "@/components/features/offers/offers-empty-state"
import { capitalizeWords } from "@/lib/listing-labels"
import { cn } from "@/lib/utils"
import {
  dashboardFilterSelectClass,
  dashboardPageSubtitleClass,
  dashboardPageTitleClass,
  dashboardSearchInputClass,
} from "@/lib/utils/dashboard-display-styles"
import type {
  DashboardOfferRow,
  DashboardProfileLite,
} from "@/lib/types/offers-dashboard"
import {
  dashboardListingForOffer,
  isInactiveOffer,
  offerIsSoldPresentation,
  partitionOffersByRole,
  type OffersRoleTab,
  userParticipationRole,
} from "@/lib/utils/offers-dashboard-display"
type OffersSort = "recent" | "price_desc" | "price_asc"
type OffersStatusFilter = "all" | "active" | "pending" | "countered" | "accepted" | "completed"

function counterpartyForOffer(
  offer: DashboardOfferRow,
  role: "buyer" | "seller",
  sellersById: Record<string, DashboardProfileLite>,
  buyersById: Record<string, DashboardProfileLite>,
): DashboardProfileLite | undefined {
  return role === "buyer" ? sellersById[offer.seller_id] : buyersById[offer.buyer_id]
}

function sortOffers(offers: DashboardOfferRow[], sort: OffersSort): DashboardOfferRow[] {
  const next = [...offers]
  switch (sort) {
    case "price_desc":
      return next.sort((a, b) => b.current_amount - a.current_amount)
    case "price_asc":
      return next.sort((a, b) => a.current_amount - b.current_amount)
    case "recent":
    default:
      return next.sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      )
  }
}

function matchesStatusFilter(offer: DashboardOfferRow, filter: OffersStatusFilter): boolean {
  if (filter === "all") return true
  if (filter === "active") return !isInactiveOffer(offer) && !offerIsSoldPresentation(offer)
  if (filter === "completed") return offer.status === "COMPLETED" || offerIsSoldPresentation(offer)
  return offer.status === filter.toUpperCase()
}

function filterOffersList(
  offers: DashboardOfferRow[],
  {
    searchQuery,
    sort,
    activeOnly,
    hideExpired,
    hidePurchased,
    statusFilter,
  }: {
    searchQuery: string
    sort: OffersSort
    activeOnly: boolean
    hideExpired: boolean
    hidePurchased: boolean
    statusFilter: OffersStatusFilter
  },
): DashboardOfferRow[] {
  const q = searchQuery.trim().toLowerCase()
  let filtered = offers.filter((o) => {
    if (activeOnly && isInactiveOffer(o)) return false
    if (hideExpired && o.status === "EXPIRED") return false
    if (hidePurchased && (o.status === "COMPLETED" || offerIsSoldPresentation(o))) return false
    if (!matchesStatusFilter(o, statusFilter)) return false
    if (!q) return true
    const listing = dashboardListingForOffer(o)
    const title = listing?.title?.toLowerCase() ?? ""
    const amount = String(o.current_amount)
    return title.includes(q) || amount.includes(q)
  })
  return sortOffers(filtered, sort)
}

export interface DashboardOffersViewProps {
  userId: string
  offers: DashboardOfferRow[]
  sellersById: Record<string, DashboardProfileLite>
  buyersById: Record<string, DashboardProfileLite>
  minPctByListingId: Record<string, number>
  defaultTab?: OffersRoleTab
  /** When true, default "Active offers only" on seller tab (messages inbox). */
  activeOnlyDefault?: boolean
  /** Base path for tab URL sync (default /dashboard/offers). */
  basePath?: string
}

export function DashboardOffersView({
  userId,
  offers,
  sellersById,
  buyersById,
  minPctByListingId,
  defaultTab = "seller",
  activeOnlyDefault = false,
  basePath = "/dashboard/offers",
}: DashboardOffersViewProps) {
  const router = useRouter()
  const [tab, setTab] = useState<OffersRoleTab>(defaultTab)
  const [searchQuery, setSearchQuery] = useState("")
  const [sort, setSort] = useState<OffersSort>("recent")
  const [statusFilter, setStatusFilter] = useState<OffersStatusFilter>("all")
  const [activeOnly, setActiveOnly] = useState(activeOnlyDefault)
  const [hideExpired, setHideExpired] = useState(false)
  const [hidePurchased, setHidePurchased] = useState(false)
  const [dialogOffer, setDialogOffer] = useState<DashboardOfferRow | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [buyerCounterOffer, setBuyerCounterOffer] = useState<DashboardOfferRow | null>(null)
  const [buyerCounterOpen, setBuyerCounterOpen] = useState(false)

  useEffect(() => {
    setTab(defaultTab)
  }, [defaultTab])

  const { seller: sellerOffers, buyer: buyerOffers } = useMemo(
    () => partitionOffersByRole(offers, userId),
    [offers, userId],
  )

  const syncUrl = (next: OffersRoleTab) => {
    const path = next === "buyer" ? `${basePath}?tab=buyer` : basePath
    router.replace(path, { scroll: false })
  }

  const roleOffers = tab === "seller" ? sellerOffers : buyerOffers
  const visibleOffers = useMemo(
    () =>
      filterOffersList(roleOffers, {
        searchQuery,
        sort,
        activeOnly: tab === "seller" ? activeOnly : false,
        hideExpired: tab === "buyer" ? hideExpired : false,
        hidePurchased: tab === "buyer" ? hidePurchased : false,
        statusFilter: tab === "buyer" ? statusFilter : "all",
      }),
    [
      roleOffers,
      searchQuery,
      sort,
      activeOnly,
      hideExpired,
      hidePurchased,
      statusFilter,
      tab,
    ],
  )

  const openRespond = (o: DashboardOfferRow) => {
    setDialogOffer(o)
    setDialogOpen(true)
  }

  const openBuyerCounter = (o: DashboardOfferRow) => {
    setBuyerCounterOffer(o)
    setBuyerCounterOpen(true)
  }

  const listingForDialog = dialogOffer ? dashboardListingForOffer(dialogOffer) : null
  const listPriceNum = listingForDialog
    ? Math.round(parseFloat(String(listingForDialog.price)) * 100) / 100
    : 0
  const minPct = dialogOffer ? minPctByListingId[dialogOffer.listing_id] ?? 70 : 70
  const minOfferAmount = Number.isFinite(listPriceNum)
    ? Math.round(listPriceNum * (minPct / 100) * 100) / 100
    : 0

  const offerRowLite: OfferRowLite | null = dialogOffer
    ? {
        id: dialogOffer.id,
        status: dialogOffer.status,
        current_amount: dialogOffer.current_amount,
        buyer_id: dialogOffer.buyer_id,
        seller_id: dialogOffer.seller_id,
        fulfillment: dialogOffer.fulfillment ?? null,
        shipping_amount: dialogOffer.shipping_amount ?? null,
      }
    : null

  const titleForDialog = listingForDialog?.title?.trim()
    ? capitalizeWords(listingForDialog.title)
    : "Listing"

  const listingForBuyerCounter = buyerCounterOffer ? dashboardListingForOffer(buyerCounterOffer) : null
  const listPriceBuyerCounter = listingForBuyerCounter
    ? Math.round(parseFloat(String(listingForBuyerCounter.price)) * 100) / 100
    : 0
  const titleBuyerCounter = listingForBuyerCounter?.title?.trim()
    ? capitalizeWords(listingForBuyerCounter.title)
    : "Listing"

  const subtitle =
    tab === "seller"
      ? "Send discounted offers to interested buyers who have your boards in their carts."
      : "Send offers to sellers on boards you're looking for."

  return (
    <div className="space-y-0">
      <header className="border-b border-border/60 pb-6">
        <h1 className={dashboardPageTitleClass}>Offers</h1>
        <p className={cn("max-w-2xl", dashboardPageSubtitleClass)}>{subtitle}</p>

        <div
          className="mt-6 flex w-full gap-1 rounded-xl border border-border/60 bg-muted/50 p-1"
          role="tablist"
          aria-label="Seller and buyer offers"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === "seller"}
            onClick={() => {
              setTab("seller")
              syncUrl("seller")
            }}
            className={cn(
              "flex min-h-touch flex-1 items-center justify-center rounded-lg px-4 text-[14px] font-semibold transition-colors",
              tab === "seller"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Seller
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "buyer"}
            onClick={() => {
              setTab("buyer")
              syncUrl("buyer")
            }}
            className={cn(
              "flex min-h-touch flex-1 items-center justify-center rounded-lg px-4 text-[14px] font-semibold transition-colors",
              tab === "buyer"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Buyer
          </button>
        </div>
      </header>

      {tab === "buyer" ? (
        <div className="mt-6 rounded-2xl border border-rose-100/80 bg-rose-50/60 px-4 py-4 dark:border-rose-950/40 dark:bg-rose-950/20 sm:px-5 sm:py-5">
          <p className="text-[15px] font-semibold text-foreground">Make offers on any listing</p>
          <p className="mt-1 max-w-2xl text-[14px] leading-relaxed text-muted-foreground">
            Open a board you want, tap Make an offer, and your negotiations will appear here on the
            Buyer tab.
          </p>
        </div>
      ) : null}

      <div className="mt-6 flex flex-col gap-4 border-b border-border/60 pb-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search your offers"
              className={dashboardSearchInputClass}
              aria-label="Search your offers"
            />
          </div>
          <Select value={sort} onValueChange={(v) => setSort(v as OffersSort)}>
            <SelectTrigger className={cn(dashboardFilterSelectClass, "w-full")}>
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Sort: Most recent</SelectItem>
              <SelectItem value="price_desc">Sort: Price high to low</SelectItem>
              <SelectItem value="price_asc">Sort: Price low to high</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {tab === "seller" ? (
          <div className="flex items-center gap-2">
            <Checkbox
              id="offers-active-only"
              checked={activeOnly}
              onCheckedChange={(checked) => setActiveOnly(checked === true)}
            />
            <Label htmlFor="offers-active-only" className="cursor-pointer text-[14px] font-medium">
              Active offers only
            </Label>
          </div>
        ) : (
          <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as OffersStatusFilter)}
            >
              <SelectTrigger className={cn(dashboardFilterSelectClass, "w-full sm:w-[180px]")}>
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="countered">Countered</SelectItem>
                <SelectItem value="accepted">Accepted</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="offers-hide-expired"
                  checked={hideExpired}
                  onCheckedChange={(checked) => setHideExpired(checked === true)}
                />
                <Label htmlFor="offers-hide-expired" className="cursor-pointer text-[14px] font-medium">
                  Hide expired
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="offers-hide-purchased"
                  checked={hidePurchased}
                  onCheckedChange={(checked) => setHidePurchased(checked === true)}
                />
                <Label htmlFor="offers-hide-purchased" className="cursor-pointer text-[14px] font-medium">
                  Hide purchased
                </Label>
              </div>
            </div>
          </div>
        )}
      </div>

      <p className="mt-4 text-[13px] text-muted-foreground">
        {visibleOffers.length === 0 ? "No offers found" : `${visibleOffers.length} offer${visibleOffers.length === 1 ? "" : "s"}`}
      </p>

      {roleOffers.length === 0 ? (
        <OffersEmptyState role={tab} />
      ) : visibleOffers.length === 0 ? (
        <p className="py-16 text-center text-[15px] text-muted-foreground">No offers match your filters.</p>
      ) : (
        <div className="mt-2 space-y-3 pb-6">
          {visibleOffers.map((o) => {
            const role = userParticipationRole(o, userId) ?? "buyer"
            return (
              <OfferRow
                key={o.id}
                offer={o}
                role={role}
                compact
                counterparty={counterpartyForOffer(o, role, sellersById, buyersById)}
                listingTitle={dashboardListingForOffer(o)?.title ?? ""}
                onRespondOpen={openRespond}
                onViewCounterOpen={role === "buyer" ? openBuyerCounter : undefined}
              />
            )
          })}
        </div>
      )}

      {offerRowLite ? (
        <SellerOfferResponseDialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open)
            if (!open) setDialogOffer(null)
          }}
          offer={offerRowLite}
          listingTitle={titleForDialog}
          listPrice={listPriceNum}
          minOfferAmount={minOfferAmount}
          minOfferPct={minPct}
          buyerNote={dialogOffer?.buyer_note}
          onCompleted={async () => {
            router.refresh()
          }}
        />
      ) : null}

      {buyerCounterOffer ? (
        <BuyerCounterOfferDialog
          open={buyerCounterOpen}
          onOpenChange={(open) => {
            setBuyerCounterOpen(open)
            if (!open) setBuyerCounterOffer(null)
          }}
          offer={{
            id: buyerCounterOffer.id,
            status: buyerCounterOffer.status,
            initial_amount: buyerCounterOffer.initial_amount,
            current_amount: buyerCounterOffer.current_amount,
            seller_counter_note: buyerCounterOffer.seller_counter_note,
            seller_initiated: buyerCounterOffer.seller_initiated ?? false,
            expires_at: buyerCounterOffer.expires_at,
            fulfillment: buyerCounterOffer.fulfillment ?? null,
            shipping_amount: buyerCounterOffer.shipping_amount ?? null,
          }}
          listingTitle={titleBuyerCounter}
          listPrice={listPriceBuyerCounter}
          onCompleted={async () => {
            router.refresh()
          }}
        />
      ) : null}
    </div>
  )
}
