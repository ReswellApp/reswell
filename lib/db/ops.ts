import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  OpsFixTicketRow,
  OpsGroupRow,
  OpsGroupStatus,
  OpsIngestRunRow,
  OpsIngestSource,
  OpsIngestStatus,
  OpsSignalRow,
  OpsSource,
  OpsSeverity,
  OpsTicketPriority,
  OpsTicketStatus,
} from "@/lib/types/ops"
import {
  OPS_GROUP_LIST_SELECT,
  OPS_SIGNAL_LIST_SELECT,
  OPS_TICKET_LIST_SELECT,
} from "@/lib/types/ops"

export type UpsertOpsGroupInput = {
  fingerprint: string
  referenceCode: string
  source: OpsSource
  severity: OpsSeverity
  title: string
  message: string
  stackSample?: string | null
  category?: string | null
  path?: string | null
  environment?: string | null
  lastUrl?: string | null
  release?: string | null
  metadata?: Record<string, unknown>
  occurredAt?: string
  occurrenceDelta?: number
}

export type InsertOpsSignalInput = {
  groupId: string
  source: OpsSource
  externalId?: string | null
  userId?: string | null
  url?: string | null
  userAgent?: string | null
  digest?: string | null
  payload?: Record<string, unknown>
  occurredAt?: string
}

export async function findOpsGroupByFingerprint(
  supabase: SupabaseClient,
  fingerprint: string,
): Promise<OpsGroupRow | null> {
  const { data, error } = await supabase
    .from("ops_groups")
    .select(OPS_GROUP_LIST_SELECT)
    .eq("fingerprint", fingerprint)
    .maybeSingle()

  if (error) {
    console.error("[ops] findOpsGroupByFingerprint:", error.message)
    throw new Error(error.message)
  }
  return (data as OpsGroupRow | null) ?? null
}

export async function insertOpsGroup(
  supabase: SupabaseClient,
  input: UpsertOpsGroupInput,
): Promise<OpsGroupRow> {
  const occurredAt = input.occurredAt ?? new Date().toISOString()
  const { data, error } = await supabase
    .from("ops_groups")
    .insert({
      fingerprint: input.fingerprint,
      reference_code: input.referenceCode,
      source: input.source,
      severity: input.severity,
      title: input.title,
      message: input.message,
      stack_sample: input.stackSample ?? null,
      category: input.category ?? null,
      path: input.path ?? null,
      environment: input.environment ?? null,
      occurrence_count: input.occurrenceDelta ?? 1,
      first_seen_at: occurredAt,
      last_seen_at: occurredAt,
      last_url: input.lastUrl ?? null,
      release: input.release ?? null,
      metadata: input.metadata ?? {},
    })
    .select(OPS_GROUP_LIST_SELECT)
    .single()

  if (error) {
    console.error("[ops] insertOpsGroup:", error.message)
    throw new Error(error.message)
  }
  return data as OpsGroupRow
}

export async function bumpOpsGroup(
  supabase: SupabaseClient,
  group: OpsGroupRow,
  input: UpsertOpsGroupInput,
): Promise<OpsGroupRow> {
  const occurredAt = input.occurredAt ?? new Date().toISOString()
  const firstSeen =
    Date.parse(occurredAt) < Date.parse(group.first_seen_at)
      ? occurredAt
      : group.first_seen_at
  const lastSeen =
    Date.parse(occurredAt) > Date.parse(group.last_seen_at)
      ? occurredAt
      : group.last_seen_at

  const nextStatus: OpsGroupStatus =
    group.status === "resolved" || group.status === "ignored" ? "open" : group.status

  const { data, error } = await supabase
    .from("ops_groups")
    .update({
      severity:
        severityRank(input.severity) < severityRank(group.severity)
          ? input.severity
          : group.severity,
      title: input.title || group.title,
      message: input.message || group.message,
      stack_sample: input.stackSample ?? group.stack_sample,
      category: input.category ?? group.category,
      path: input.path ?? group.path,
      environment: input.environment ?? group.environment,
      occurrence_count: group.occurrence_count + (input.occurrenceDelta ?? 1),
      first_seen_at: firstSeen,
      last_seen_at: lastSeen,
      last_url: input.lastUrl ?? group.last_url,
      release: input.release ?? group.release,
      metadata: { ...group.metadata, ...(input.metadata ?? {}) },
      status: nextStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", group.id)
    .select(OPS_GROUP_LIST_SELECT)
    .single()

  if (error) {
    console.error("[ops] bumpOpsGroup:", error.message)
    throw new Error(error.message)
  }
  return data as OpsGroupRow
}

function severityRank(severity: OpsSeverity): number {
  if (severity === "critical") return 0
  if (severity === "warning") return 1
  return 2
}

export async function findOpsSignalByExternalId(
  supabase: SupabaseClient,
  source: OpsSource,
  externalId: string,
): Promise<OpsSignalRow | null> {
  const { data, error } = await supabase
    .from("ops_signals")
    .select(OPS_SIGNAL_LIST_SELECT)
    .eq("source", source)
    .eq("external_id", externalId)
    .maybeSingle()

  if (error) {
    console.error("[ops] findOpsSignalByExternalId:", error.message)
    return null
  }
  return (data as OpsSignalRow | null) ?? null
}

export async function insertOpsSignal(
  supabase: SupabaseClient,
  input: InsertOpsSignalInput,
): Promise<OpsSignalRow | null> {
  const { data, error } = await supabase
    .from("ops_signals")
    .insert({
      group_id: input.groupId,
      source: input.source,
      external_id: input.externalId ?? null,
      user_id: input.userId ?? null,
      url: input.url ?? null,
      user_agent: input.userAgent ?? null,
      digest: input.digest ?? null,
      payload: input.payload ?? {},
      occurred_at: input.occurredAt ?? new Date().toISOString(),
    })
    .select(OPS_SIGNAL_LIST_SELECT)
    .maybeSingle()

  if (error) {
    // Duplicate external_id → already ingested
    if (error.code === "23505") return null
    console.error("[ops] insertOpsSignal:", error.message)
    throw new Error(error.message)
  }
  return (data as OpsSignalRow | null) ?? null
}

export async function listOpsGroups(
  supabase: SupabaseClient,
  filters: {
    status?: OpsGroupStatus | "all"
    source?: OpsSource | "all"
    q?: string
    limit?: number
  } = {},
): Promise<OpsGroupRow[]> {
  let query = supabase
    .from("ops_groups")
    .select(OPS_GROUP_LIST_SELECT)
    .order("last_seen_at", { ascending: false })
    .limit(filters.limit ?? 100)

  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status)
  }
  if (filters.source && filters.source !== "all") {
    query = query.eq("source", filters.source)
  }
  if (filters.q?.trim()) {
    const safe = filters.q.trim().replace(/[%_,.()]/g, " ").slice(0, 80)
    if (safe) {
      const q = `%${safe}%`
      query = query.or(
        `title.ilike.${q},message.ilike.${q},reference_code.ilike.${q},path.ilike.${q}`,
      )
    }
  }

  const { data, error } = await query
  if (error) {
    console.error("[ops] listOpsGroups:", error.message)
    throw new Error(error.message)
  }
  return (data ?? []) as OpsGroupRow[]
}

/** Open-issue rows used to build per-view badge counts (overview / vercel / react…). */
export async function listOpenOpsGroupsForCounts(
  supabase: SupabaseClient,
  limit = 500,
): Promise<OpsGroupRow[]> {
  const { data, error } = await supabase
    .from("ops_groups")
    .select(OPS_GROUP_LIST_SELECT)
    .eq("status", "open")
    .order("last_seen_at", { ascending: false })
    .limit(limit)

  if (error) {
    console.error("[ops] listOpenOpsGroupsForCounts:", error.message)
    throw new Error(error.message)
  }
  return (data ?? []) as OpsGroupRow[]
}

export async function getOpsGroupById(
  supabase: SupabaseClient,
  id: string,
): Promise<OpsGroupRow | null> {
  const { data, error } = await supabase
    .from("ops_groups")
    .select(OPS_GROUP_LIST_SELECT)
    .eq("id", id)
    .maybeSingle()

  if (error) {
    console.error("[ops] getOpsGroupById:", error.message)
    throw new Error(error.message)
  }
  return (data as OpsGroupRow | null) ?? null
}

export async function listOpsSignalsForGroup(
  supabase: SupabaseClient,
  groupId: string,
  limit = 50,
): Promise<OpsSignalRow[]> {
  const { data, error } = await supabase
    .from("ops_signals")
    .select(OPS_SIGNAL_LIST_SELECT)
    .eq("group_id", groupId)
    .order("occurred_at", { ascending: false })
    .limit(limit)

  if (error) {
    console.error("[ops] listOpsSignalsForGroup:", error.message)
    throw new Error(error.message)
  }
  return (data ?? []) as OpsSignalRow[]
}

export async function listOpsTicketsForGroup(
  supabase: SupabaseClient,
  groupId: string,
): Promise<OpsFixTicketRow[]> {
  const { data, error } = await supabase
    .from("ops_fix_tickets")
    .select(OPS_TICKET_LIST_SELECT)
    .eq("group_id", groupId)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("[ops] listOpsTicketsForGroup:", error.message)
    throw new Error(error.message)
  }
  return (data ?? []) as OpsFixTicketRow[]
}

export async function updateOpsGroupStatus(
  supabase: SupabaseClient,
  groupId: string,
  status: OpsGroupStatus,
): Promise<OpsGroupRow> {
  const { data, error } = await supabase
    .from("ops_groups")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", groupId)
    .select(OPS_GROUP_LIST_SELECT)
    .single()

  if (error) {
    console.error("[ops] updateOpsGroupStatus:", error.message)
    throw new Error(error.message)
  }
  return data as OpsGroupRow
}

export async function insertOpsFixTicket(
  supabase: SupabaseClient,
  input: {
    groupId: string
    title: string
    notes?: string
    priority?: OpsTicketPriority
    createdBy?: string | null
  },
): Promise<OpsFixTicketRow> {
  const { data, error } = await supabase
    .from("ops_fix_tickets")
    .insert({
      group_id: input.groupId,
      title: input.title,
      notes: input.notes ?? "",
      priority: input.priority ?? "medium",
      created_by: input.createdBy ?? null,
    })
    .select(OPS_TICKET_LIST_SELECT)
    .single()

  if (error) {
    console.error("[ops] insertOpsFixTicket:", error.message)
    throw new Error(error.message)
  }
  return data as OpsFixTicketRow
}

export async function updateOpsFixTicket(
  supabase: SupabaseClient,
  ticketId: string,
  patch: {
    status?: OpsTicketStatus
    notes?: string
    priority?: OpsTicketPriority
  },
): Promise<OpsFixTicketRow> {
  const { data, error } = await supabase
    .from("ops_fix_tickets")
    .update({
      ...("status" in patch ? { status: patch.status } : {}),
      ...("notes" in patch ? { notes: patch.notes } : {}),
      ...("priority" in patch ? { priority: patch.priority } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", ticketId)
    .select(OPS_TICKET_LIST_SELECT)
    .single()

  if (error) {
    console.error("[ops] updateOpsFixTicket:", error.message)
    throw new Error(error.message)
  }
  return data as OpsFixTicketRow
}

export async function countOpenOpsGroups(supabase: SupabaseClient): Promise<number> {
  const { count, error } = await supabase
    .from("ops_groups")
    .select("*", { count: "exact", head: true })
    .eq("status", "open")

  if (error) {
    console.error("[ops] countOpenOpsGroups:", error.message)
    return 0
  }
  return count ?? 0
}

export async function insertOpsIngestRun(
  supabase: SupabaseClient,
  input: {
    source: OpsIngestSource
    status: OpsIngestStatus
    rangeHours?: number | null
    signalsIngested?: number
    groupsUpserted?: number
    errorMessage?: string | null
    meta?: Record<string, unknown>
    startedAt?: string
    finishedAt?: string | null
  },
): Promise<OpsIngestRunRow> {
  const { data, error } = await supabase
    .from("ops_ingest_runs")
    .insert({
      source: input.source,
      status: input.status,
      range_hours: input.rangeHours ?? null,
      signals_ingested: input.signalsIngested ?? 0,
      groups_upserted: input.groupsUpserted ?? 0,
      error_message: input.errorMessage ?? null,
      meta: input.meta ?? {},
      started_at: input.startedAt ?? new Date().toISOString(),
      finished_at: input.finishedAt ?? new Date().toISOString(),
    })
    .select(
      "id, source, status, range_hours, signals_ingested, groups_upserted, error_message, meta, started_at, finished_at",
    )
    .single()

  if (error) {
    console.error("[ops] insertOpsIngestRun:", error.message)
    throw new Error(error.message)
  }
  return data as OpsIngestRunRow
}

export async function listRecentOpsIngestRuns(
  supabase: SupabaseClient,
  limit = 20,
): Promise<OpsIngestRunRow[]> {
  const { data, error } = await supabase
    .from("ops_ingest_runs")
    .select(
      "id, source, status, range_hours, signals_ingested, groups_upserted, error_message, meta, started_at, finished_at",
    )
    .order("started_at", { ascending: false })
    .limit(limit)

  if (error) {
    console.error("[ops] listRecentOpsIngestRuns:", error.message)
    throw new Error(error.message)
  }
  return (data ?? []) as OpsIngestRunRow[]
}
