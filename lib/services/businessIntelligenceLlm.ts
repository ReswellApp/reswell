import { generateText, Output } from "ai"

import {
  APP_LLM_FEATURES,
  gatewayTagsForFeature,
  isAppLlmFeatureEnabled,
  resolveConfiguredModel,
} from "@/lib/llm/app-models"
import type { BusinessIntelligenceSnapshot } from "@/lib/types/businessIntelligence"
import {
  businessIntelligenceLlmReportSchema,
  type BusinessIntelligenceLlmReport,
} from "@/lib/validations/businessIntelligence"

const FEATURE = APP_LLM_FEATURES.find((f) => f.id === "business_intelligence")

export function businessIntelligenceModelId(): string {
  if (!FEATURE) return "google/gemini-2.5-pro"
  return resolveConfiguredModel(FEATURE)
}

export function isBusinessIntelligenceLlmEnabled(): boolean {
  if (!FEATURE) return false
  return isAppLlmFeatureEnabled(FEATURE)
}

function compactSnapshotForLlm(snapshot: BusinessIntelligenceSnapshot): Record<string, unknown> {
  return {
    period: {
      kind: snapshot.periodKind,
      key: snapshot.periodKey,
      label: snapshot.periodLabel,
      compareLabel: snapshot.compareLabel,
      days: snapshot.periodDays,
      startDate: snapshot.startDate,
      endDate: snapshot.endDate,
    },
    commerce: {
      gmv: snapshot.commerce.gmv,
      platformRevenue: snapshot.commerce.platformRevenue,
      marketingExpense: snapshot.commerce.marketingExpense,
      orders: snapshot.commerce.orders,
      aov: snapshot.commerce.aov,
      takeRatePct: snapshot.commerce.takeRatePct,
      refundRatePct: snapshot.commerce.refundRatePct,
      refundCount: snapshot.commerce.refundCount,
      topBrands: snapshot.commerce.topBrands.slice(0, 6),
      sectionMix: snapshot.commerce.sectionMix.slice(0, 6),
    },
    growth: snapshot.growth,
    mostClickedUrl: snapshot.mostClickedUrl,
    topPages: (snapshot.topPagesGa4.length > 0
      ? snapshot.topPagesGa4
      : snapshot.topPagesFirstParty
    ).slice(0, 10),
    search: {
      configured: snapshot.search.configured,
      totalSearches: snapshot.search.totalSearches,
      uniqueQueriesApprox: snapshot.search.uniqueQueriesApprox,
      zeroResultEventCount: snapshot.search.zeroResultEventCount,
      topQueries: snapshot.search.topQueries.slice(0, 10),
      zeroResultQueries: snapshot.search.zeroResultQueries.slice(0, 8),
    },
    funnel: snapshot.funnel,
    ads: snapshot.ads,
    monthlyHistory: snapshot.monthlyHistory.slice(0, 12),
    runRateProjections: snapshot.runRate,
    priorBriefings: snapshot.priorBriefings,
  }
}

export async function generateBusinessIntelligenceBriefing(
  snapshot: BusinessIntelligenceSnapshot,
): Promise<BusinessIntelligenceLlmReport> {
  if (!isBusinessIntelligenceLlmEnabled()) {
    throw new Error(
      "Business intelligence LLM is not configured. Set AI_GATEWAY_API_KEY or deploy with Vercel OIDC.",
    )
  }

  const payload = compactSnapshotForLlm(snapshot)
  const { output } = await generateText({
    model: businessIntelligenceModelId(),
    output: Output.object({ schema: businessIntelligenceLlmReportSchema }),
    system: `You are Reswell Intelligence, the operating partner for Reswell Health — a used-surfboard marketplace (peer listings) plus Reswell shop retail.

Your job: read the numeric snapshot and write a briefing that helps founders run the business. Ground every claim in the provided numbers. Never invent metrics, URLs, brands, or dollar amounts that are not in the snapshot. If a series is thin, say so and lower projection confidence.

Definitions:
- GMV / GMS = buyer-paid merchandise on confirmed orders (item price net of promo, excluding shipping) plus listing prices of off-platform mark-as-sold sales with a succeeded seller tip, USD. Shipping collected from buyers is not GMV.
- Platform revenue = Reswell marketplace take (7% of listing item price). Promo codes do not reduce this take.
- Take rate = platform_fee ÷ listing item GMV (seller earnings + platform fee). Target 7%.
- Marketing expense = Reswell-funded promo discounts (newsletter + admin-issued codes). Counted as marketing, not as a take-rate reduction.
- New users / listings = profiles and listings created in the period (Pacific Time).
- Most clicked URL = top pagePath by views (GA4 preferred, else first-party page views).
- Run-rate projections in the snapshot are naive (period average × 7/30/90). Interpret them; do not treat them as forecasts. Adjust the labeled ranges using MoM, refund rate, supply, and seasonality. Prefer ranges over false precision.

Write like an operator: specific, ranked, and actionable. Recommendations must name a concrete next step (sourcing, search synonyms, ads, listing quality, fulfillment, conversion). Use priorBriefings to notice recurring themes across days/weeks/months.`,
    prompt: `Write the ${snapshot.periodKind} operating briefing for ${snapshot.periodLabel} (vs ${snapshot.compareLabel}).

Snapshot JSON:
${JSON.stringify(payload)}`,
    temperature: 0.2,
    providerOptions: {
      gateway: {
        tags: gatewayTagsForFeature("business_intelligence"),
      },
    },
  })

  if (!output) {
    throw new Error("The model returned an empty briefing.")
  }
  return output
}
