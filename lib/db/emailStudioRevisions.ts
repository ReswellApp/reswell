import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  EmailStudioCommand,
  EmailStudioChangeSource,
  EmailStudioProposal,
  EmailStudioProposalStatus,
  EmailStudioRevision,
  EmailStudioScope,
} from "@/lib/types/emailStudioCommands"
import {
  emailStudioEmailCommandSchema,
  emailStudioEmailSnapshotSchema,
  emailStudioFlowCommandSchema,
  emailStudioFlowSnapshotSchema,
} from "@/lib/validations/emailStudioCommands"

type RevisionRow = {
  id: string
  scope: string
  scope_id: string
  revision: number
  schema_version: number
  snapshot: unknown
  source: string
  summary: string
  commands: unknown
  created_by: string | null
  created_at: string
}

type ProposalRow = {
  id: string
  scope: string
  scope_id: string
  base_revision: number
  status: string
  summary: string
  assistant_message: string
  commands: unknown
  created_by: string
  resolved_by: string | null
  claimed_at: string | null
  accepted_revision: number | null
  created_at: string
  resolved_at: string | null
}

function parseCommands(scope: EmailStudioScope, value: unknown): EmailStudioCommand[] {
  if (!Array.isArray(value)) return []
  const schema = scope === "email" ? emailStudioEmailCommandSchema : emailStudioFlowCommandSchema
  return value.flatMap((command) => {
    const parsed = schema.safeParse(command)
    return parsed.success ? [parsed.data] : []
  })
}

function changeSource(value: string): EmailStudioChangeSource {
  if (value === "assistant" || value === "restore" || value === "human") return value
  return "system"
}

function toRevision(row: RevisionRow): EmailStudioRevision | null {
  const scope: EmailStudioScope = row.scope === "flow" ? "flow" : "email"
  const base = {
    id: row.id,
    scopeId: row.scope_id,
    revision: row.revision,
    schemaVersion: row.schema_version,
    source: changeSource(row.source),
    summary: row.summary,
    commands: parseCommands(scope, row.commands),
    createdBy: row.created_by,
    createdAt: row.created_at,
  }
  if (scope === "email") {
    const parsed = emailStudioEmailSnapshotSchema.safeParse(row.snapshot)
    return parsed.success ? { ...base, scope, snapshot: parsed.data } : null
  }
  const parsed = emailStudioFlowSnapshotSchema.safeParse(row.snapshot)
  return parsed.success ? { ...base, scope, snapshot: parsed.data } : null
}

function proposalStatus(value: string): EmailStudioProposalStatus {
  if (
    value === "applying"
    || value === "accepted"
    || value === "rejected"
    || value === "superseded"
  ) return value
  return "pending"
}

function toProposal(row: ProposalRow): EmailStudioProposal {
  const scope: EmailStudioScope = row.scope === "flow" ? "flow" : "email"
  return {
    id: row.id,
    scope,
    scopeId: row.scope_id,
    baseRevision: row.base_revision,
    status: proposalStatus(row.status),
    summary: row.summary,
    assistantMessage: row.assistant_message,
    commands: parseCommands(scope, row.commands),
    createdBy: row.created_by,
    resolvedBy: row.resolved_by,
    claimedAt: row.claimed_at,
    acceptedRevision: row.accepted_revision,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  }
}

export async function listEmailStudioRevisions(
  supabase: SupabaseClient,
  scope: EmailStudioScope,
  scopeId: string,
  limit = 30,
): Promise<EmailStudioRevision[]> {
  const { data, error } = await supabase
    .from("email_studio_revisions")
    .select("id, scope, scope_id, revision, schema_version, snapshot, source, summary, commands, created_by, created_at")
    .eq("scope", scope)
    .eq("scope_id", scopeId)
    .order("revision", { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return ((data ?? []) as RevisionRow[]).flatMap((row) => {
    const revision = toRevision(row)
    return revision ? [revision] : []
  })
}

export async function getEmailStudioRevision(
  supabase: SupabaseClient,
  scope: EmailStudioScope,
  scopeId: string,
  revision: number,
): Promise<EmailStudioRevision | null> {
  const { data, error } = await supabase
    .from("email_studio_revisions")
    .select("id, scope, scope_id, revision, schema_version, snapshot, source, summary, commands, created_by, created_at")
    .eq("scope", scope)
    .eq("scope_id", scopeId)
    .eq("revision", revision)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? toRevision(data as RevisionRow) : null
}

export async function insertEmailStudioProposal(
  supabase: SupabaseClient,
  args: {
    scope: EmailStudioScope
    scopeId: string
    baseRevision: number
    summary: string
    assistantMessage: string
    commands: EmailStudioCommand[]
    userId: string
  },
): Promise<EmailStudioProposal> {
  const { data, error } = await supabase
    .from("email_studio_proposals")
    .insert({
      scope: args.scope,
      scope_id: args.scopeId,
      base_revision: args.baseRevision,
      summary: args.summary,
      assistant_message: args.assistantMessage,
      commands: args.commands,
      created_by: args.userId,
    })
    .select("id, scope, scope_id, base_revision, status, summary, assistant_message, commands, created_by, resolved_by, claimed_at, accepted_revision, created_at, resolved_at")
    .single()
  if (error || !data) throw new Error(error?.message ?? "Could not save assistant proposal")
  return toProposal(data as ProposalRow)
}

export async function getEmailStudioProposal(
  supabase: SupabaseClient,
  id: string,
): Promise<EmailStudioProposal | null> {
  const { data, error } = await supabase
    .from("email_studio_proposals")
    .select("id, scope, scope_id, base_revision, status, summary, assistant_message, commands, created_by, resolved_by, claimed_at, accepted_revision, created_at, resolved_at")
    .eq("id", id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? toProposal(data as ProposalRow) : null
}

export async function getPendingEmailStudioProposal(
  supabase: SupabaseClient,
  scope: EmailStudioScope,
  scopeId: string,
): Promise<EmailStudioProposal | null> {
  const { data, error } = await supabase
    .from("email_studio_proposals")
    .select("id, scope, scope_id, base_revision, status, summary, assistant_message, commands, created_by, resolved_by, claimed_at, accepted_revision, created_at, resolved_at")
    .eq("scope", scope)
    .eq("scope_id", scopeId)
    .in("status", ["pending", "applying"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? toProposal(data as ProposalRow) : null
}

export async function resolveEmailStudioProposal(
  supabase: SupabaseClient,
  args: {
    id: string
    status: "accepted" | "rejected" | "superseded"
    userId: string
    acceptedRevision?: number | null
  },
): Promise<boolean> {
  const expectedStatuses = args.status === "accepted"
    ? ["applying"]
    : args.status === "rejected"
      ? ["pending"]
      : ["pending", "applying"]
  const { data, error } = await supabase
    .from("email_studio_proposals")
    .update({
      status: args.status,
      resolved_by: args.userId,
      accepted_revision: args.acceptedRevision ?? null,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", args.id)
    .in("status", expectedStatuses)
    .select("id")
    .maybeSingle()
  if (error) throw new Error(error.message)
  return Boolean(data)
}

export async function claimEmailStudioProposal(
  supabase: SupabaseClient,
  id: string,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("email_studio_proposals")
    .update({
      status: "applying",
      resolved_by: userId,
      claimed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle()
  if (error) throw new Error(error.message)
  return Boolean(data)
}

export async function releaseEmailStudioProposalClaim(
  supabase: SupabaseClient,
  id: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("email_studio_proposals")
    .update({
      status: "pending",
      resolved_by: null,
      claimed_at: null,
    })
    .eq("id", id)
    .eq("status", "applying")
    .select("id")
    .maybeSingle()
  if (error) throw new Error(error.message)
  return Boolean(data)
}
