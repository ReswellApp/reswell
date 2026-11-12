import type { WorkforceAgentDefinition, WorkforceAgentId } from "@/lib/workforce-agents/types"
import { WORKFORCE_AGENT_IDS } from "@/lib/workforce-agents/types"

export const WORKFORCE_AGENT_CATALOG: readonly WorkforceAgentDefinition[] = [
  {
    id: "shop-scout",
    name: "Shop Scout",
    shortDescription:
      "Finds surf-shop recruitment targets from CRM and shop profiles that still need outreach.",
    category: "supply",
    mode: "auto",
    cadence: "Daily",
    recommended: true,
  },
  {
    id: "shop-mailer",
    name: "Shop Mailer",
    shortDescription:
      "Drafts intro and follow-up emails for shop leads with due follow-ups (Gmail send stays human-approved).",
    category: "supply",
    mode: "assist",
    cadence: "Daily",
    recommended: true,
  },
  {
    id: "fb-supply-copilot",
    name: "FB Supply Copilot",
    shortDescription:
      "Triages Facebook Marketplace CRM leads and drafts reply notes. Does not scrape or auto-DM Marketplace.",
    category: "supply",
    mode: "assist",
    cadence: "Daily",
    recommended: true,
  },
  {
    id: "meta-ads-writer",
    name: "Meta Ads Writer",
    shortDescription: "Builds a fresh Meta ad-copy pack you can paste into Ads Manager as paused ads.",
    category: "ads",
    mode: "auto",
    cadence: "Monthly",
    recommended: true,
  },
  {
    id: "listing-completer",
    name: "Listing Completer",
    shortDescription: "Surfaces unfinished listing drafts that need photos, price, or publish.",
    category: "supply",
    mode: "auto",
    cadence: "Hourly-ish (cron)",
    recommended: true,
  },
  {
    id: "seller-reactivator",
    name: "Seller Reactivator",
    shortDescription: "Finds sellers who went quiet and ranks who to win back first.",
    category: "supply",
    mode: "auto",
    cadence: "Daily",
    recommended: true,
  },
  {
    id: "shopify-shop-closer",
    name: "Shopify Shop Closer",
    shortDescription: "Finds shop accounts that have not connected Shopify yet and queues pitch notes.",
    category: "supply",
    mode: "auto",
    cadence: "Weekly",
    recommended: false,
  },
  {
    id: "price-guide-ops",
    name: "Price Guide Ops",
    shortDescription: "Flags live listings that look mispriced versus recent sold comps.",
    category: "demand",
    mode: "auto",
    cadence: "Daily",
    recommended: true,
  },
  {
    id: "buyer-matchmaker",
    name: "Buyer Matchmaker",
    shortDescription: "Matches new live listings to saved searches and favorites watchers.",
    category: "demand",
    mode: "auto",
    cadence: "Daily",
    recommended: true,
  },
  {
    id: "cs-escalation",
    name: "CS Escalation Buddy",
    shortDescription: "Watches aging open support cases that need a human nudge.",
    category: "ops",
    mode: "auto",
    cadence: "Hourly-ish (cron)",
    recommended: false,
  },
  {
    id: "content-seo",
    name: "Content SEO",
    shortDescription: "Proposes weekly SEO post angles tied to used-board and shop keywords.",
    category: "demand",
    mode: "auto",
    cadence: "Weekly",
    recommended: false,
  },
  {
    id: "trust-fraud",
    name: "Trust & Fraud Watch",
    shortDescription: "Reviews recent fraud-flagged marketplace messages for follow-up.",
    category: "trust",
    mode: "auto",
    cadence: "Daily",
    recommended: true,
  },
  {
    id: "weekly-pnl",
    name: "Weekly P&L Pilot",
    shortDescription: "Builds a founder digest of recent GMS, orders, and listing velocity.",
    category: "finance",
    mode: "auto",
    cadence: "Weekly (Mon)",
    recommended: true,
  },
  {
    id: "local-dropoff",
    name: "Local Drop-off Ops",
    shortDescription: "Checks active drop-off locations and listings waiting on local drop-off.",
    category: "ops",
    mode: "auto",
    cadence: "Daily",
    recommended: false,
  },
] as const

const BY_ID = new Map(WORKFORCE_AGENT_CATALOG.map((agent) => [agent.id, agent]))

export function getWorkforceAgentDefinition(
  id: string,
): WorkforceAgentDefinition | undefined {
  return BY_ID.get(id as WorkforceAgentId)
}

export function isWorkforceAgentId(value: string): value is WorkforceAgentId {
  return (WORKFORCE_AGENT_IDS as readonly string[]).includes(value)
}

export const WORKFORCE_CATEGORY_LABELS: Record<
  WorkforceAgentDefinition["category"],
  string
> = {
  supply: "Supply",
  demand: "Demand",
  ads: "Ads",
  ops: "Ops",
  trust: "Trust",
  finance: "Finance",
}
