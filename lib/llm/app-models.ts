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
  | "support_reply_draft"
  | "listing_brand_model_research"
  | "message_fraud_review"

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
      "Turns free-text /boards queries into structured facet filters (brand, price, fins, length, etc.). Uses curated search synonyms and admin Good/Close/Bad search-quality memory to recover aliases and typos. Elasticsearch still does retrieval.",
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
      "lib/services/searchQuality.ts",
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
      "Gemini reads marketplace searches, dropdown picks, and zero-result queries for a day, month, or all-time window, writes an operator briefing with a ranked demand list, and adds catalog-validated search synonyms for alias/typo empty searches.",
    gatewayFeatureTag: "feature:search-daily-report",
    transport: "vercel_ai_gateway",
    defaultModel: "google/gemini-2.5-pro",
    modelEnvVar: "SEARCH_DAILY_REPORT_MODEL",
    enabledEnvVar: "SEARCH_DAILY_REPORT_ENABLED",
    surfaces: [
      "/admin/search-daily-report",
      "GET /api/cron/search-daily-report",
      "GET /api/cron/search-period-report",
      "POST /api/admin/search-daily-report",
      "POST /api/admin/search-period-report",
      "POST /api/admin/search-daily-report/synonyms",
    ],
    sourceFiles: [
      "lib/services/searchDailyReport.ts",
      "lib/services/searchPeriodReport.ts",
      "lib/services/searchDailyReportSynonyms.ts",
      "app/api/cron/search-daily-report/route.ts",
      "app/api/cron/search-period-report/route.ts",
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
  {
    id: "support_reply_draft",
    name: "Support reply drafts",
    purpose:
      "Reswell-only CS agent harness: drafts a review-before-send reply from a context pack (thread, order, prior tickets, help, rated examples, macros) plus optional server tools. Starts the moment a customer writes in so the inbox can read a ready draft. Never auto-sends. No fine-tune.",
    gatewayFeatureTag: "feature:support-reply-draft",
    transport: "vercel_ai_gateway",
    defaultModel: "google/gemini-2.5-flash",
    modelEnvVar: "SUPPORT_REPLY_DRAFT_MODEL",
    enabledEnvVar: "SUPPORT_REPLY_DRAFT_ENABLED",
    surfaces: [
      "/admin/contact-messages",
      "/admin/support-reply-examples",
      "GET /api/cron/support-reply-drafts",
    ],
    sourceFiles: [
      "lib/llm/cs-agent.ts",
      "lib/llm/cs-agent-generate.ts",
      "lib/services/supportReplyDraft.ts",
      "lib/services/csAgentLookups.ts",
      "lib/services/supportReplyExamples.ts",
      "lib/services/supportReplyKnowledge.ts",
      "lib/db/supportReplyDrafts.ts",
      "lib/db/supportReplyRootPrompt.ts",
    ],
  },
  {
    id: "listing_brand_model_research",
    name: "Listing brand/model research",
    purpose:
      "When a live listing cannot be matched to the catalog, researches the seller’s brand/model (official shaper site only) and creates the missing catalog row only at high confidence. Low-confidence cases stay on the admin unmatched worklist.",
    gatewayFeatureTag: "feature:listing-brand-model-research",
    transport: "vercel_ai_gateway",
    defaultModel: "google/gemini-2.5-flash",
    modelEnvVar: "LISTING_BRAND_MODEL_RESEARCH_MODEL",
    enabledEnvVar: "LISTING_BRAND_MODEL_RESEARCH_ENABLED",
    surfaces: [
      "GET /api/cron/backfill-listing-brand-model",
      "/admin/listings/brand-model-autofills",
    ],
    sourceFiles: [
      "lib/services/listingBrandModelResearch.ts",
      "lib/services/listingBrandModelBackfill.ts",
      "lib/utils/listing-brand-model-research-decision.ts",
    ],
  },
  {
    id: "message_fraud_review",
    name: "Marketplace message fraud review",
    purpose:
      "Second-pass Gemini review for marketplace DMs that regex already flagged (phone, Venmo/Zelle/cash, email, phishing) or that look like evasion. Confirms fraud or allows innocent wording. Send-path timeout is sub-second; a cron re-reviews pending rows.",
    gatewayFeatureTag: "feature:message-fraud-review",
    transport: "vercel_ai_gateway",
    defaultModel: "google/gemini-2.5-flash-lite",
    modelEnvVar: "MESSAGE_FRAUD_REVIEW_MODEL",
    enabledEnvVar: "MESSAGE_FRAUD_REVIEW_ENABLED",
    surfaces: [
      "marketplace DMs",
      "/admin/fraud-messages",
      "GET /api/cron/review-fraud-messages",
    ],
    sourceFiles: [
      "lib/services/messageFraudReview.ts",
      "lib/services/reviewFraudMessagesBatch.ts",
      "lib/messages/message-policy-enforcement.ts",
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
