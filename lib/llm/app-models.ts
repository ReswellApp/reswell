/**
 * Catalog of LLM features used in Reswell.
 * Keep in sync when adding or changing model-backed features.
 */

export type LlmTransport = "vercel_ai_gateway" | "anthropic_direct"

export type AppLlmFeatureId =
  | "marketplace_nl_search"
  | "sell_catalog_nl_search"
  | "listing_description"
  | "business_intelligence"
  | "search_daily_report"

export interface AppLlmFeatureDefinition {
  id: AppLlmFeatureId
  name: string
  purpose: string
  /** Gateway reporting tag used for cost attribution (`feature:…`). */
  gatewayFeatureTag: string | null
  transport: LlmTransport
  defaultModel: string
  modelEnvVar: string | null
  enabledEnvVar: string | null
  /** Product surfaces / routes that invoke this feature. */
  surfaces: string[]
  sourceFiles: string[]
}

export const APP_LLM_FEATURES: readonly AppLlmFeatureDefinition[] = [
  {
    id: "marketplace_nl_search",
    name: "Marketplace NL search",
    purpose:
      "Turns free-text /boards queries into structured facet filters (brand, price, fins, length, etc.). Uses curated search synonyms to recover aliases and typos. Elasticsearch still does retrieval.",
    gatewayFeatureTag: "feature:marketplace-nl-search",
    transport: "vercel_ai_gateway",
    defaultModel: "google/gemini-2.5-flash",
    modelEnvVar: "MARKETPLACE_NL_SEARCH_MODEL",
    enabledEnvVar: "MARKETPLACE_NL_SEARCH_ENABLED",
    surfaces: ["/boards", "GET /api/search/nl-helper"],
    sourceFiles: [
      "lib/services/marketplaceQueryUnderstand.ts",
      "lib/services/marketplaceNlHelper.ts",
      "lib/services/searchSynonyms.ts",
    ],
  },
  {
    id: "sell_catalog_nl_search",
    name: "Sell catalog NL helper",
    purpose:
      "Normalizes messy seller search text on /sell into brand/model/category so catalog Elasticsearch matching can succeed.",
    gatewayFeatureTag: "feature:sell-catalog-nl-search",
    transport: "vercel_ai_gateway",
    defaultModel: "google/gemini-2.5-flash",
    modelEnvVar: "SELL_CATALOG_NL_SEARCH_MODEL",
    enabledEnvVar: "SELL_CATALOG_NL_SEARCH_ENABLED",
    surfaces: ["/sell", "GET /api/sell/catalog-search/nl-helper"],
    sourceFiles: [
      "lib/services/sellCatalogQueryUnderstand.ts",
      "lib/services/sellCatalogNlHelper.ts",
    ],
  },
  {
    id: "listing_description",
    name: "Listing description writer",
    purpose:
      "Streams a short first-person listing description when sellers use “Write description for me”.",
    gatewayFeatureTag: null,
    transport: "anthropic_direct",
    defaultModel: "claude-sonnet-4-5-20250929",
    modelEnvVar: null,
    enabledEnvVar: null,
    surfaces: ["POST /api/listings/generate-description"],
    sourceFiles: ["app/api/listings/generate-description/route.ts"],
  },
  {
    id: "search_daily_report",
    name: "Search daily report",
    purpose:
      "Once a day, Gemini reads marketplace searches, dropdown picks, and zero-result queries, writes an operator briefing, and adds catalog-validated search synonyms for alias/typo empty searches.",
    gatewayFeatureTag: "feature:search-daily-report",
    transport: "vercel_ai_gateway",
    defaultModel: "google/gemini-2.5-pro",
    modelEnvVar: "SEARCH_DAILY_REPORT_MODEL",
    enabledEnvVar: "SEARCH_DAILY_REPORT_ENABLED",
    surfaces: [
      "/admin/search-daily-report",
      "GET /api/cron/search-daily-report",
      "POST /api/admin/search-daily-report",
      "POST /api/admin/search-daily-report/synonyms",
    ],
    sourceFiles: [
      "lib/services/searchDailyReport.ts",
      "lib/services/searchDailyReportSynonyms.ts",
      "app/api/cron/search-daily-report/route.ts",
    ],
  },
  {
    id: "business_intelligence",
    name: "Business intelligence briefings",
    purpose:
      "Turns admin marketplace, traffic, and growth snapshots into saved daily/weekly/monthly operating reports with projections and recommendations.",
    gatewayFeatureTag: "feature:business-intelligence",
    transport: "vercel_ai_gateway",
    defaultModel: "google/gemini-2.5-pro",
    modelEnvVar: "BUSINESS_INTELLIGENCE_MODEL",
    enabledEnvVar: "BUSINESS_INTELLIGENCE_ENABLED",
    surfaces: [
      "/admin/intelligence",
      "GET /api/cron/intelligence-report",
      "POST /api/admin/intelligence/reports",
    ],
    sourceFiles: [
      "lib/services/businessIntelligence.ts",
      "lib/services/businessIntelligenceLlm.ts",
      "lib/services/businessIntelligenceSnapshot.ts",
    ],
  },
] as const

export function resolveConfiguredModel(feature: AppLlmFeatureDefinition): string {
  if (feature.modelEnvVar) {
    const override = process.env[feature.modelEnvVar]?.trim()
    if (override) return override
  }
  return feature.defaultModel
}

function gatewayAuthConfigured(): boolean {
  return Boolean(
    process.env.AI_GATEWAY_API_KEY?.trim() || process.env.VERCEL_OIDC_TOKEN?.trim(),
  )
}

/**
 * Mirrors the enablement rules used by the NL search services.
 * Anthropic feature is enabled when ANTHROPIC_API_KEY is present.
 */
export function isAppLlmFeatureEnabled(feature: AppLlmFeatureDefinition): boolean {
  if (feature.transport === "anthropic_direct") {
    return Boolean(process.env.ANTHROPIC_API_KEY?.trim())
  }

  if (feature.enabledEnvVar) {
    const flag = process.env[feature.enabledEnvVar]
    if (flag === "false") return false
    if (flag === "true") return true
  }

  return gatewayAuthConfigured()
}

export function gatewayEnvTag(): string {
  const env = process.env.VERCEL_ENV?.trim() || process.env.NODE_ENV || "development"
  return `env:${env}`
}

/** Tags attached to every AI Gateway request for spend attribution. */
export function gatewayTagsForFeature(featureId: AppLlmFeatureId): string[] {
  const feature = APP_LLM_FEATURES.find((f) => f.id === featureId)
  if (!feature?.gatewayFeatureTag) return [gatewayEnvTag(), "product:reswell"]
  return [feature.gatewayFeatureTag, gatewayEnvTag(), "product:reswell"]
}
