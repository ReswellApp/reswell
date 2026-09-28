import type { AdsMetrics } from "@/lib/types/adsManager"

export function emptyMetrics(): AdsMetrics {
  return {
    impressions: 0,
    clicks: 0,
    spend: 0,
    conversions: 0,
    conversionValue: 0,
    ctr: 0,
    cpc: null,
    cpa: null,
    roas: null,
  }
}

export function buildMetrics(input: {
  impressions: number
  clicks: number
  spend: number
  conversions: number
  conversionValue: number
}): AdsMetrics {
  const impressions = finite(input.impressions)
  const clicks = finite(input.clicks)
  const spend = finite(input.spend)
  const conversions = finite(input.conversions)
  const conversionValue = finite(input.conversionValue)
  return {
    impressions,
    clicks,
    spend,
    conversions,
    conversionValue,
    ctr: impressions > 0 ? clicks / impressions : 0,
    cpc: clicks > 0 ? spend / clicks : null,
    cpa: conversions > 0 ? spend / conversions : null,
    roas: spend > 0 && conversionValue > 0 ? conversionValue / spend : null,
  }
}

export function sumMetrics(rows: AdsMetrics[]): AdsMetrics {
  return buildMetrics(
    rows.reduce(
      (total, row) => ({
        impressions: total.impressions + row.impressions,
        clicks: total.clicks + row.clicks,
        spend: total.spend + row.spend,
        conversions: total.conversions + row.conversions,
        conversionValue: total.conversionValue + row.conversionValue,
      }),
      { impressions: 0, clicks: 0, spend: 0, conversions: 0, conversionValue: 0 },
    ),
  )
}

function finite(value: number): number {
  return Number.isFinite(value) ? value : 0
}
