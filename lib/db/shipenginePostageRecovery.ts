import type { SupabaseClient } from "@supabase/supabase-js"
import type { PostageAuditRow, PostageRecoverySummary } from "@/lib/shipping/recover-unused-postage"
import type { PostageDisposition, PostageRecoveryKind } from "@/lib/shipping/unused-label-void-policy"

export type PostageVoidHint = {
  adminVoidRequested: boolean
  attemptCount: number
}

export type PostageRecoverySnapshot = {
  finishedAt: string
  autoVoidEnabled: boolean
  truncated: boolean
  listedCount: number
  lookbackDays: number
  buyerRefundsIssued: 0
  summary: PostageRecoverySummary
  cracks: PostageAuditRow[]
  recoveredThisRun: PostageAuditRow[]
}

const LEDGER_WRITE_CHUNK = 200

function num(value: number | string | null | undefined): number {
  const n = typeof value === "number" ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}

export async function dbListPostageVoidHints(
  supabase: SupabaseClient,
  sinceIso: string,
): Promise<{ data: Map<string, PostageVoidHint>; error: Error | null }> {
  const out = new Map<string, PostageVoidHint>()
  const [recent, openAdmin] = await Promise.all([
    supabase
      .from("shipengine_label_void_ledger")
      .select("label_id, admin_void_requested, attempt_count")
      .gte("label_created_at", sinceIso),
    supabase
      .from("shipengine_label_void_ledger")
      .select("label_id, admin_void_requested, attempt_count")
      .eq("admin_void_requested", true)
      .eq("shipengine_voided", false),
  ])

  if (recent.error) return { data: out, error: new Error(recent.error.message) }
  if (openAdmin.error) return { data: out, error: new Error(openAdmin.error.message) }

  for (const row of [...(recent.data ?? []), ...(openAdmin.data ?? [])]) {
    const r = row as {
      label_id: string
      admin_void_requested: boolean | null
      attempt_count: number | null
    }
    const prev = out.get(r.label_id)
    out.set(r.label_id, {
      adminVoidRequested: Boolean(r.admin_void_requested) || Boolean(prev?.adminVoidRequested),
      attemptCount: Math.max(num(r.attempt_count), prev?.attemptCount ?? 0),
    })
  }

  return { data: out, error: null }
}

export async function dbUpsertPostageLedger(
  supabase: SupabaseClient,
  rows: PostageAuditRow[],
  auditedAtIso: string,
): Promise<{ error: Error | null }> {
  for (let i = 0; i < rows.length; i += LEDGER_WRITE_CHUNK) {
    const chunk = rows.slice(i, i + LEDGER_WRITE_CHUNK).map((row) => ({
      label_id: row.labelId,
      tracking_number: row.trackingNumber,
      carrier_code: row.carrierCode,
      carrier_id: row.carrierId,
      service_code: row.serviceCode,
      is_return_label: row.isReturnLabel,
      label_created_at: row.createdAt || null,
      postage_usd: row.postageUsd,
      insurance_usd: row.insuranceUsd,
      order_id: row.orderId,
      disposition: row.disposition satisfies PostageDisposition,
      recovery_kind: row.recoveryKind satisfies PostageRecoveryKind,
      scan_status_code: row.scanStatusCode,
      admin_void_requested: row.adminVoidRequested,
      void_approved: row.voidApproved,
      shipengine_voided: row.shipengineVoided,
      void_message: row.message,
      attempt_count: row.attemptCount,
      last_audited_at: auditedAtIso,
      updated_at: auditedAtIso,
    }))
    const { error } = await supabase.from("shipengine_label_void_ledger").upsert(chunk, {
      onConflict: "label_id",
    })
    if (error) return { error: new Error(error.message) }
  }
  return { error: null }
}

export async function dbInsertPostageRecoveryRun(
  supabase: SupabaseClient,
  input: {
    startedAtIso: string
    finishedAtIso: string
    autoVoidEnabled: boolean
    truncated: boolean
    listedCount: number
    result: PostageRecoverySnapshot
  },
): Promise<{ error: Error | null }> {
  const { error } = await supabase.from("shipengine_postage_recovery_runs").insert({
    started_at: input.startedAtIso,
    finished_at: input.finishedAtIso,
    auto_void_enabled: input.autoVoidEnabled,
    truncated: input.truncated,
    listed_count: input.listedCount,
    result: input.result,
  })
  if (error) return { error: new Error(error.message) }
  return { error: null }
}

export async function dbLatestPostageRecoveryRun(
  supabase: SupabaseClient,
): Promise<{ data: PostageRecoverySnapshot | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("shipengine_postage_recovery_runs")
    .select("result")
    .order("finished_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return { data: null, error: new Error(error.message) }
  const result = (data as { result?: PostageRecoverySnapshot } | null)?.result ?? null
  return { data: result, error: null }
}

export async function dbRecordAdminVoidAttempt(
  supabase: SupabaseClient,
  input: {
    labelId: string
    trackingNumber: string | null
    carrierCode: string | null
    carrierId: string | null
    orderId: string
    approved: boolean
    shipengineVoided: boolean
    message: string
    recoveryKind: PostageRecoveryKind
    disposition: PostageDisposition
  },
): Promise<{ error: Error | null }> {
  const existing = await supabase
    .from("shipengine_label_void_ledger")
    .select("attempt_count, postage_usd, insurance_usd, label_created_at, is_return_label")
    .eq("label_id", input.labelId)
    .maybeSingle()

  if (existing.error) return { error: new Error(existing.error.message) }

  const prev = existing.data as {
    attempt_count?: number | null
    postage_usd?: number | string | null
    insurance_usd?: number | string | null
    label_created_at?: string | null
    is_return_label?: boolean | null
  } | null

  const nowIso = new Date().toISOString()
  const { error } = await supabase.from("shipengine_label_void_ledger").upsert(
    {
      label_id: input.labelId,
      tracking_number: input.trackingNumber,
      carrier_code: input.carrierCode,
      carrier_id: input.carrierId,
      order_id: input.orderId,
      disposition: input.disposition,
      recovery_kind: input.recoveryKind,
      admin_void_requested: true,
      void_approved: input.approved,
      shipengine_voided: input.shipengineVoided,
      void_message: input.message,
      attempt_count: num(prev?.attempt_count) + 1,
      postage_usd: num(prev?.postage_usd),
      insurance_usd: num(prev?.insurance_usd),
      is_return_label: Boolean(prev?.is_return_label),
      label_created_at: prev?.label_created_at ?? null,
      last_audited_at: nowIso,
      updated_at: nowIso,
    },
    { onConflict: "label_id" },
  )
  if (error) return { error: new Error(error.message) }
  return { error: null }
}
