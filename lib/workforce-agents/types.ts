export const WORKFORCE_AGENT_IDS = [
  "shop-scout",
  "shop-mailer",
  "fb-supply-copilot",
  "meta-ads-writer",
  "listing-completer",
  "seller-reactivator",
  "shopify-shop-closer",
  "price-guide-ops",
  "buyer-matchmaker",
  "cs-escalation",
  "content-seo",
  "trust-fraud",
  "weekly-pnl",
  "local-dropoff",
] as const

export type WorkforceAgentId = (typeof WORKFORCE_AGENT_IDS)[number]

export type WorkforceAgentCategory =
  | "supply"
  | "demand"
  | "ads"
  | "ops"
  | "trust"
  | "finance"

export type WorkforceAgentMode = "auto" | "assist"

export type WorkforceRunStatus = "ok" | "error" | "skipped"

export type WorkforceTriggeredBy = "manual" | "cron" | "system"

export type WorkforceAgentDefinition = {
  id: WorkforceAgentId
  name: string
  shortDescription: string
  category: WorkforceAgentCategory
  mode: WorkforceAgentMode
  /** Human cadence hint shown in admin. */
  cadence: string
  /** Default on for new installs after seed (seed starts false; this is UX guidance). */
  recommended: boolean
}

export type WorkforceRunResult = {
  status: WorkforceRunStatus
  summary: string
  detail?: Record<string, unknown>
}

export type WorkforceAgentRow = {
  id: WorkforceAgentId
  enabled: boolean
  last_run_at: string | null
  last_run_status: WorkforceRunStatus | "idle" | null
  last_run_summary: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export type WorkforceAgentRunRow = {
  id: string
  agent_id: WorkforceAgentId
  status: WorkforceRunStatus
  summary: string
  detail: Record<string, unknown>
  triggered_by: WorkforceTriggeredBy
  created_at: string
}

export type WorkforceAgentAdminView = WorkforceAgentDefinition & {
  enabled: boolean
  lastRunAt: string | null
  lastRunStatus: WorkforceRunStatus | "idle" | null
  lastRunSummary: string | null
  updatedAt: string | null
  recentRuns: WorkforceAgentRunRow[]
}
