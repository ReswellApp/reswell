export type OpsSource = "vercel" | "supabase" | "client" | "server"
export type OpsSeverity = "critical" | "warning" | "info"
export type OpsGroupStatus = "open" | "acknowledged" | "resolved" | "ignored"
export type OpsTicketStatus = "open" | "in_progress" | "done"
export type OpsTicketPriority = "low" | "medium" | "high" | "urgent"
export type OpsIngestSource = "vercel" | "supabase" | "manual"
export type OpsIngestStatus = "success" | "partial" | "failed" | "skipped"

export interface OpsGroupRow {
  id: string
  fingerprint: string
  reference_code: string
  source: OpsSource
  severity: OpsSeverity
  status: OpsGroupStatus
  title: string
  message: string
  stack_sample: string | null
  category: string | null
  path: string | null
  environment: string | null
  occurrence_count: number
  first_seen_at: string
  last_seen_at: string
  last_url: string | null
  release: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface OpsSignalRow {
  id: string
  group_id: string
  source: OpsSource
  external_id: string | null
  user_id: string | null
  url: string | null
  user_agent: string | null
  digest: string | null
  payload: Record<string, unknown>
  occurred_at: string
  created_at: string
}

export interface OpsFixTicketRow {
  id: string
  group_id: string
  title: string
  notes: string
  status: OpsTicketStatus
  priority: OpsTicketPriority
  created_by: string | null
  assignee_id: string | null
  created_at: string
  updated_at: string
}

export interface OpsIngestRunRow {
  id: string
  source: OpsIngestSource
  status: OpsIngestStatus
  range_hours: number | null
  signals_ingested: number
  groups_upserted: number
  error_message: string | null
  meta: Record<string, unknown>
  started_at: string
  finished_at: string | null
}

export const OPS_GROUP_LIST_SELECT =
  "id, fingerprint, reference_code, source, severity, status, title, message, stack_sample, category, path, environment, occurrence_count, first_seen_at, last_seen_at, last_url, release, metadata, created_at, updated_at" as const

export const OPS_SIGNAL_LIST_SELECT =
  "id, group_id, source, external_id, user_id, url, user_agent, digest, payload, occurred_at, created_at" as const

export const OPS_TICKET_LIST_SELECT =
  "id, group_id, title, notes, status, priority, created_by, assignee_id, created_at, updated_at" as const
