import { listingDetailHref } from "@/lib/listing-href"
import { formatOrderNumForCustomer } from "@/lib/order-num-display"
import {
  fetchListingsForAdSales,
  fetchOrdersForAdSales,
  isListingUuid,
} from "@/lib/db/adAttributedSales"
import { fetchFirstPartyAdAttributedSales } from "@/lib/db/orderAdAttribution"
import { META_ADS_MANAGER_URL_PARAMETERS } from "@/lib/ads/tracking-urls"
import {
  getGoogleAnalyticsSetupHint,
  googleAnalyticsDateWindow,
  isGoogleAnalyticsConfigured,
  runGoogleAnalyticsReport,
} from "@/lib/services/googleAnalytics"

export const AD_SALES_CHANNELS = ["google_ads", "meta_ads", "meta_referral"] as const
export type AdSalesChannel = (typeof AD_SALES_CHANNELS)[number]

export type AdSalesChannelTotals = {
  itemsPurchased: number
  revenue: number
  listings: number
  orders: number
}

export type AdSalesListingRow = {
  listingId: string
  title: string
  slug: string | null
  status: string | null
  href: string | null
  thumbnailUrl: string | null
  matched: boolean
  channel: AdSalesChannel
  itemsPurchased: number
  revenue: number
  campaigns: string[]
  sourceMediums: string[]
  orderIds: string[]
  dataSource: "first_party" | "ga4"
}

export type AdSalesOrderRow = {
  orderId: string
  orderNum: string
  createdAt: string
  status: string
  amount: number
  isAdminTest: boolean
  channel: AdSalesChannel
  listingId: string
  listingTitle: string
  campaign: string | null
  source: string
  medium: string
  itemsPurchased: number
  revenue: number
  dataSource: "first_party" | "ga4"
  clickId: string | null
  landingPath: string | null
}

export type AdSalesDailyRow = {
  date: string
  googleAdsRevenue: number
  metaAdsRevenue: number
  metaReferralRevenue: number
}

export type AdSalesDashboardData = {
  configured: true
  rangeDays: number
  propertyId: string | null
  ga4Configured: boolean
  ga4Reason: string | null
  generatedAt: string
  startDate: string
  endDate: string
  totals: Record<AdSalesChannel, AdSalesChannelTotals>
  ga4Totals: Record<AdSalesChannel, AdSalesChannelTotals>
  listings: AdSalesListingRow[]
  orders: AdSalesOrderRow[]
  daily: AdSalesDailyRow[]
  insights: string[]
  metaAdsManagerParams: string
}

export type AdSalesUnconfigured = {
  configured: false
  reason: string
}

export type AdSalesDashboardResult = AdSalesDashboardData | AdSalesUnconfigured

type ParsedPurchaseRow = {
  date: string | null
  transactionId: string | null
  itemId: string
  itemName: string
  source: string
  medium: string
  campaign: string | null
  googleAdsCampaign: string | null
  itemsPurchased: number
  revenue: number
}

const NOT_SET = new Set(["", "(not set)", "(none)", "(data not available)", "(other)"])
const PAID_MEDIUMS = new Set([
  "cpc",
  "ppc",
  "paid",
  "paidsearch",
  "paid_search",
  "paid-search",
  "shopping",
  "display",
  "paidsocial",
  "paid_social",
  "paid-social",
])
const GOOGLE_SOURCES = new Set(["google", "googleads", "google ads", "google-ads", "adwords"])
const ITEMS_PURCHASED_FILTER = {
  filter: {
    fieldName: "itemsPurchased",
    numericFilter: { operation: "GREATER_THAN" as const, value: { doubleValue: 0 } },
  },
}

function dim(value: string | undefined): string {
  return (value ?? "").trim()
}

function isSet(value: string | null | undefined): value is string {
  if (!value) return false
  return !NOT_SET.has(value.trim().toLowerCase())
}

function displayDim(value: string | null | undefined): string | null {
  return isSet(value) ? value.trim() : null
}

function sourceMedium(source: string, medium: string): string {
  return `${isSet(source) ? source : "(direct)"} / ${isSet(medium) ? medium : "(none)"}`
}

function isGoogleAdsSource(row: ParsedPurchaseRow): boolean {
  if (isSet(row.googleAdsCampaign)) return true
  const source = row.source.trim().toLowerCase()
  const medium = row.medium.trim().toLowerCase()
  if (GOOGLE_SOURCES.has(source) && PAID_MEDIUMS.has(medium)) return true
  if (source === "google" && medium === "cross-network") return true
  return false
}

function isMetaHost(source: string): boolean {
  const s = source.trim().toLowerCase()
  if (!s) return false
  return (
    s === "fb" ||
    s === "ig" ||
    s === "meta" ||
    s === "an" ||
    s.includes("facebook") ||
    s.includes("instagram")
  )
}

function classifyChannel(row: ParsedPurchaseRow): AdSalesChannel | null {
  if (isGoogleAdsSource(row)) return "google_ads"
  if (!isMetaHost(row.source)) return null
  const medium = row.medium.trim().toLowerCase()
  if (PAID_MEDIUMS.has(medium)) return "meta_ads"
  return "meta_referral"
}

function emptyTotals(): AdSalesChannelTotals {
  return { itemsPurchased: 0, revenue: 0, listings: 0, orders: 0 }
}

function parseRows(
  dimensions: string[],
  rows: { dimensionValues: string[]; metricValues: number[] }[],
): ParsedPurchaseRow[] {
  const index = (name: string) => dimensions.indexOf(name)
  const dateIdx = index("date")
  const txnIdx = index("transactionId")
  const itemIdIdx = index("itemId")
  const itemNameIdx = index("itemName")
  const sourceIdx = index("sessionSource")
  const mediumIdx = index("sessionMedium")
  const campaignIdx = index("sessionCampaignName")
  const googleAdsIdx = index("googleAdsCampaignName")

  const parsed: ParsedPurchaseRow[] = []
  for (const row of rows) {
    const itemId = dim(row.dimensionValues[itemIdIdx])
    if (!itemId || itemId.toLowerCase() === "(not set)") continue
    const itemsPurchased = row.metricValues[0] ?? 0
    const revenue = row.metricValues[1] ?? 0
    if (itemsPurchased <= 0 && revenue <= 0) continue

    const rawDate = dateIdx >= 0 ? dim(row.dimensionValues[dateIdx]) : ""
    parsed.push({
      date:
        rawDate.length === 8
          ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`
          : rawDate || null,
      transactionId: txnIdx >= 0 ? displayDim(dim(row.dimensionValues[txnIdx])) : null,
      itemId,
      itemName: dim(row.dimensionValues[itemNameIdx]) || itemId,
      source: dim(row.dimensionValues[sourceIdx]),
      medium: dim(row.dimensionValues[mediumIdx]),
      campaign: campaignIdx >= 0 ? displayDim(dim(row.dimensionValues[campaignIdx])) : null,
      googleAdsCampaign: googleAdsIdx >= 0 ? displayDim(dim(row.dimensionValues[googleAdsIdx])) : null,
      itemsPurchased,
      revenue,
    })
  }
  return parsed
}

async function queryPurchaseRows(
  startDate: string,
  endDate: string,
): Promise<
  | { ok: false; reason: string }
  | { ok: true; propertyId: string; rows: ParsedPurchaseRow[] }
> {
  const attempts: string[][] = [
    [
      "date",
      "transactionId",
      "itemId",
      "itemName",
      "sessionSource",
      "sessionMedium",
      "sessionCampaignName",
      "googleAdsCampaignName",
    ],
    [
      "date",
      "transactionId",
      "itemId",
      "itemName",
      "sessionSource",
      "sessionMedium",
      "sessionCampaignName",
    ],
    ["itemId", "itemName", "sessionSource", "sessionMedium", "sessionCampaignName"],
  ]

  let lastReason = "Could not load purchase item data from Google Analytics."
  for (const dimensions of attempts) {
    const result = await runGoogleAnalyticsReport({
      dateRanges: [{ startDate, endDate }],
      dimensions: dimensions.map((name) => ({ name })),
      metrics: [{ name: "itemsPurchased" }, { name: "itemRevenue" }],
      metricFilter: ITEMS_PURCHASED_FILTER,
      orderBys: [{ metric: { metricName: "itemRevenue" }, desc: true }],
      limit: 10_000,
    })
    if (!result.ok) {
      lastReason = result.reason
      continue
    }
    return {
      ok: true,
      propertyId: result.propertyId,
      rows: parseRows(dimensions, result.rows),
    }
  }

  return { ok: false, reason: lastReason }
}

function buildInsights(data: {
  rangeDays: number
  totals: Record<AdSalesChannel, AdSalesChannelTotals>
  ga4Totals: Record<AdSalesChannel, AdSalesChannelTotals>
}): string[] {
  const insights: string[] = []
  const google = data.totals.google_ads
  const metaAds = data.totals.meta_ads
  const metaRef = data.totals.meta_referral
  const usd = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })

  if (google.itemsPurchased > 0) {
    insights.push(
      `Click-ID tracker: Google Ads sold ${google.itemsPurchased.toLocaleString("en-US")} item${google.itemsPurchased === 1 ? "" : "s"} (${usd(google.revenue)}) across ${google.listings} listing${google.listings === 1 ? "" : "s"}.`,
    )
  } else {
    insights.push(
      `No Google Ads click-stamped orders in the last ${data.rangeDays} days yet. New gclid landings are stored on the order at checkout.`,
    )
  }

  if (metaAds.itemsPurchased > 0) {
    insights.push(
      `Click-ID tracker: Meta Ads sold ${metaAds.itemsPurchased.toLocaleString("en-US")} item${metaAds.itemsPurchased === 1 ? "" : "s"} (${usd(metaAds.revenue)}).`,
    )
  } else if (metaRef.itemsPurchased > 0) {
    insights.push(
      `Meta catalog UTMs are on product links. ${metaRef.itemsPurchased.toLocaleString("en-US")} Facebook/Instagram sale${metaRef.itemsPurchased === 1 ? "" : "s"} landed without a paid UTM (referral). Paste URL parameters on traffic ads in Ads Manager.`,
    )
  } else {
    insights.push(
      "No Meta click-stamped orders yet. Catalog ads now include utm_source=facebook&utm_medium=paid&utm_campaign=meta_catalog.",
    )
  }

  const ga4Google = data.ga4Totals.google_ads
  if (ga4Google.itemsPurchased > 0 && google.itemsPurchased === 0) {
    insights.push(
      `GA4 modeled ${ga4Google.itemsPurchased.toLocaleString("en-US")} Google Ads item sale${ga4Google.itemsPurchased === 1 ? "" : "s"} in this window (historical, before click IDs were stored on orders).`,
    )
  }

  return insights
}

export async function getAdAttributedSalesDashboard(options?: {
  days?: number
}): Promise<AdSalesDashboardResult> {
  const days = options?.days ?? 28
  const { startDate, endDate } = googleAnalyticsDateWindow(days)
  const sinceIso = `${startDate}T00:00:00.000Z`
  const untilIso = new Date().toISOString()

  const ga4Enabled = isGoogleAnalyticsConfigured()
  const [firstPartyRows, ga4Report] = await Promise.all([
    fetchFirstPartyAdAttributedSales({ sinceIso, untilIso }),
    ga4Enabled ? queryPurchaseRows(startDate, endDate) : Promise.resolve(null),
  ])

  const listingIds = [
    ...firstPartyRows.map((row) => row.listingId),
    ...(ga4Report && ga4Report.ok ? ga4Report.rows.map((row) => row.itemId) : []),
  ]
  const ga4OrderIds =
    ga4Report && ga4Report.ok
      ? ga4Report.rows.map((row) => row.transactionId).filter((id): id is string => Boolean(id))
      : []

  const [listings, orders] = await Promise.all([
    fetchListingsForAdSales(listingIds),
    fetchOrdersForAdSales(ga4OrderIds),
  ])

  const listingAgg = new Map<string, AdSalesListingRow>()
  const orderRows: AdSalesOrderRow[] = []
  const dailyMap = new Map<string, AdSalesDailyRow>()
  const firstPartyTotals: Record<AdSalesChannel, AdSalesChannelTotals> = {
    google_ads: emptyTotals(),
    meta_ads: emptyTotals(),
    meta_referral: emptyTotals(),
  }
  const ga4Totals: Record<AdSalesChannel, AdSalesChannelTotals> = {
    google_ads: emptyTotals(),
    meta_ads: emptyTotals(),
    meta_referral: emptyTotals(),
  }
  const fpListingKeys: Record<AdSalesChannel, Set<string>> = {
    google_ads: new Set(),
    meta_ads: new Set(),
    meta_referral: new Set(),
  }
  const fpOrderKeys: Record<AdSalesChannel, Set<string>> = {
    google_ads: new Set(),
    meta_ads: new Set(),
    meta_referral: new Set(),
  }
  const ga4ListingKeys: Record<AdSalesChannel, Set<string>> = {
    google_ads: new Set(),
    meta_ads: new Set(),
    meta_referral: new Set(),
  }
  const ga4OrderKeys: Record<AdSalesChannel, Set<string>> = {
    google_ads: new Set(),
    meta_ads: new Set(),
    meta_referral: new Set(),
  }

  function bumpDaily(date: string | null, channel: AdSalesChannel, revenue: number) {
    if (!date) return
    const daily = dailyMap.get(date) ?? {
      date,
      googleAdsRevenue: 0,
      metaAdsRevenue: 0,
      metaReferralRevenue: 0,
    }
    if (channel === "google_ads") daily.googleAdsRevenue += revenue
    if (channel === "meta_ads") daily.metaAdsRevenue += revenue
    if (channel === "meta_referral") daily.metaReferralRevenue += revenue
    dailyMap.set(date, daily)
  }

  function addListing(row: AdSalesListingRow) {
    const aggKey = `${row.dataSource}:${row.channel}:${row.listingId}`
    const existing = listingAgg.get(aggKey)
    if (existing) {
      existing.itemsPurchased += row.itemsPurchased
      existing.revenue += row.revenue
      for (const campaign of row.campaigns) {
        if (!existing.campaigns.includes(campaign)) existing.campaigns.push(campaign)
      }
      for (const sm of row.sourceMediums) {
        if (!existing.sourceMediums.includes(sm)) existing.sourceMediums.push(sm)
      }
      for (const id of row.orderIds) {
        if (!existing.orderIds.includes(id)) existing.orderIds.push(id)
      }
      return
    }
    listingAgg.set(aggKey, row)
  }

  for (const row of firstPartyRows) {
    const channel = row.channel
    if (channel !== "google_ads" && channel !== "meta_ads" && channel !== "meta_referral") continue
    const listing = listings.get(row.listingId)
    const title = listing?.title?.trim() || row.listingId
    const campaign = row.utmCampaign
    const sm = sourceMedium(row.utmSource ?? "", row.utmMedium ?? "")
    const itemsPurchased = row.quantity
    const revenue = row.itemPrice * row.quantity
    addListing({
      listingId: row.listingId,
      title,
      slug: listing?.slug ?? null,
      status: listing?.status ?? null,
      href: listing
        ? listingDetailHref({ id: listing.id, slug: listing.slug, section: listing.section ?? undefined })
        : listingDetailHref({ id: row.listingId }),
      thumbnailUrl: listing?.thumbnailUrl ?? null,
      matched: Boolean(listing),
      channel,
      itemsPurchased,
      revenue,
      campaigns: campaign ? [campaign] : [],
      sourceMediums: [sm],
      orderIds: [row.orderId],
      dataSource: "first_party",
    })
    firstPartyTotals[channel].itemsPurchased += itemsPurchased
    firstPartyTotals[channel].revenue += revenue
    fpListingKeys[channel].add(row.listingId)
    fpOrderKeys[channel].add(row.orderId)
    bumpDaily(row.orderCreatedAt.slice(0, 10), channel, revenue)
    orderRows.push({
      orderId: row.orderId,
      orderNum: formatOrderNumForCustomer(row.orderNum, row.orderId),
      createdAt: row.orderCreatedAt,
      status: row.orderStatus,
      amount: row.orderAmount,
      isAdminTest: false,
      channel,
      listingId: row.listingId,
      listingTitle: title,
      campaign,
      source: row.utmSource || "(direct)",
      medium: row.utmMedium || "(none)",
      itemsPurchased,
      revenue,
      dataSource: "first_party",
      clickId: row.gclid || row.gbraid || row.wbraid || row.fbclid,
      landingPath: row.landingPath,
    })
  }

  if (ga4Report && ga4Report.ok) {
    for (const row of ga4Report.rows) {
      const channel = classifyChannel(row)
      if (!channel) continue
      const listing = listings.get(row.itemId)
      const matched = Boolean(listing)
      const title = listing?.title?.trim() || row.itemName
      const campaign = row.googleAdsCampaign || row.campaign
      const sm = sourceMedium(row.source, row.medium)
      addListing({
        listingId: row.itemId,
        title,
        slug: listing?.slug ?? null,
        status: listing?.status ?? null,
        href: listing
          ? listingDetailHref({ id: listing.id, slug: listing.slug, section: listing.section ?? undefined })
          : isListingUuid(row.itemId)
            ? listingDetailHref({ id: row.itemId })
            : null,
        thumbnailUrl: listing?.thumbnailUrl ?? null,
        matched,
        channel,
        itemsPurchased: row.itemsPurchased,
        revenue: row.revenue,
        campaigns: campaign ? [campaign] : [],
        sourceMediums: [sm],
        orderIds: row.transactionId ? [row.transactionId] : [],
        dataSource: "ga4",
      })
      ga4Totals[channel].itemsPurchased += row.itemsPurchased
      ga4Totals[channel].revenue += row.revenue
      ga4ListingKeys[channel].add(row.itemId)
      if (!row.transactionId) continue
      const order = orders.get(row.transactionId)
      if (order?.isAdminTest) continue
      ga4OrderKeys[channel].add(row.transactionId)
      orderRows.push({
        orderId: row.transactionId,
        orderNum: formatOrderNumForCustomer(order?.orderNum, row.transactionId),
        createdAt: order?.createdAt ?? row.date ?? "",
        status: order?.status ?? "unmatched",
        amount: order?.amount ?? row.revenue,
        isAdminTest: false,
        channel,
        listingId: row.itemId,
        listingTitle: title,
        campaign,
        source: isSet(row.source) ? row.source : "(direct)",
        medium: isSet(row.medium) ? row.medium : "(none)",
        itemsPurchased: row.itemsPurchased,
        revenue: row.revenue,
        dataSource: "ga4",
        clickId: null,
        landingPath: null,
      })
    }
  }

  for (const channel of AD_SALES_CHANNELS) {
    firstPartyTotals[channel].listings = fpListingKeys[channel].size
    firstPartyTotals[channel].orders = fpOrderKeys[channel].size
    ga4Totals[channel].listings = ga4ListingKeys[channel].size
    ga4Totals[channel].orders = ga4OrderKeys[channel].size
  }

  const listingsSorted = [...listingAgg.values()].sort((a, b) => b.revenue - a.revenue)
  const ordersSorted = orderRows.sort((a, b) => {
    const aTime = a.createdAt ? Date.parse(a.createdAt) : 0
    const bTime = b.createdAt ? Date.parse(b.createdAt) : 0
    return bTime - aTime
  })

  const ga4Reason =
    !ga4Enabled
      ? getGoogleAnalyticsSetupHint() || "Google Analytics is not connected."
      : ga4Report && !ga4Report.ok
        ? ga4Report.reason
        : null

  return {
    configured: true,
    rangeDays: days,
    propertyId: ga4Report && ga4Report.ok ? ga4Report.propertyId : null,
    ga4Configured: Boolean(ga4Report && ga4Report.ok),
    ga4Reason,
    generatedAt: new Date().toISOString(),
    startDate,
    endDate: untilIso.slice(0, 10),
    totals: firstPartyTotals,
    ga4Totals,
    listings: listingsSorted,
    orders: ordersSorted,
    daily: [...dailyMap.values()].sort((a, b) => a.date.localeCompare(b.date)),
    insights: buildInsights({ rangeDays: days, totals: firstPartyTotals, ga4Totals }),
    metaAdsManagerParams: META_ADS_MANAGER_URL_PARAMETERS,
  }
}
