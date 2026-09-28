import type { SupabaseClient } from "@supabase/supabase-js"
import { blankFlowDefinition } from "@/lib/email-studio/flow-definition"
import { EmailStudioRevisionConflictError } from "@/lib/email-studio/revision-conflict"
import type { EmailStudioFlowDefinition, EmailStudioFlowRecord, EmailStudioMessage } from "@/lib/types/emailStudioFlow"
import type { EmailStudioChangeSource, EmailStudioCommand } from "@/lib/types/emailStudioCommands"
import { emailStudioFlowDefinitionSchema } from "@/lib/validations/emailStudioFlow"

const SELECT =
  "id, schema_version, revision, name, notes, definition, klaviyo_flow_id, klaviyo_status, klaviyo_synced_revision, klaviyo_content_checksum, klaviyo_synced_at, klaviyo_replaced_flow_id, klaviyo_replaced_flow_status, created_at, updated_at"

type Row = {
  id: string
  schema_version: number
  revision: number
  name: string
  notes: string
  definition: unknown
  klaviyo_flow_id: string | null
  klaviyo_status: string
  klaviyo_synced_revision: number | null
  klaviyo_content_checksum: string | null
  klaviyo_synced_at: string | null
  klaviyo_replaced_flow_id: string | null
  klaviyo_replaced_flow_status: string | null
  created_at: string
  updated_at: string
}

function toRecord(row: Row): EmailStudioFlowRecord {
  const parsed = emailStudioFlowDefinitionSchema.safeParse(row.definition)
  return {
    id: row.id,
    schemaVersion: row.schema_version,
    revision: row.revision,
    name: row.name,
    notes: row.notes,
    definition: parsed.success ? parsed.data : blankFlowDefinition(),
    klaviyoFlowId: row.klaviyo_flow_id,
    klaviyoStatus: row.klaviyo_status,
    klaviyoSyncedRevision: row.klaviyo_synced_revision,
    klaviyoContentChecksum: row.klaviyo_content_checksum,
    klaviyoSyncedAt: row.klaviyo_synced_at,
    klaviyoReplacedFlowId: row.klaviyo_replaced_flow_id,
    klaviyoReplacedFlowStatus: row.klaviyo_replaced_flow_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function listEmailStudioFlows(supabase: SupabaseClient): Promise<EmailStudioFlowRecord[]> {
  const { data, error } = await supabase
    .from("email_studio_flows")
    .select(SELECT)
    .order("updated_at", { ascending: false })
    .limit(100)
  if (error) throw new Error(error.message)
  return ((data ?? []) as Row[]).map(toRecord)
}

export async function getEmailStudioFlow(
  supabase: SupabaseClient,
  id: string,
): Promise<EmailStudioFlowRecord | null> {
  const { data, error } = await supabase
    .from("email_studio_flows")
    .select(SELECT)
    .eq("id", id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? toRecord(data as Row) : null
}

export async function insertEmailStudioFlow(
  supabase: SupabaseClient,
  args: {
    name: string
    definition: EmailStudioFlowDefinition
    userId: string
    source?: EmailStudioChangeSource
    summary?: string
    commands?: EmailStudioCommand[]
  },
): Promise<EmailStudioFlowRecord> {
  const { data, error } = await supabase
    .from("email_studio_flows")
    .insert({
      name: args.name,
      notes: "",
      definition: args.definition,
      created_by: args.userId,
      updated_by: args.userId,
      change_source: args.source ?? "human",
      change_summary: args.summary ?? "Created flow",
      change_commands: args.commands ?? [],
    })
    .select(SELECT)
    .single()
  if (error) throw new Error(error.message)
  return toRecord(data as Row)
}

export async function updateEmailStudioFlow(
  supabase: SupabaseClient,
  args: {
    id: string
    name: string
    notes: string
    definition: EmailStudioFlowDefinition
    userId: string
    klaviyoFlowId?: string | null
    klaviyoStatus?: string
    klaviyoSyncedRevision?: number | null
    klaviyoContentChecksum?: string | null
    klaviyoSyncedAt?: string | null
    klaviyoReplacedFlowId?: string | null
    klaviyoReplacedFlowStatus?: string | null
    expectedRevision?: number
    schemaVersion?: number
    source?: EmailStudioChangeSource
    summary?: string
    commands?: EmailStudioCommand[]
  },
): Promise<EmailStudioFlowRecord> {
  const patch: Record<string, unknown> = {
    name: args.name,
    notes: args.notes,
    definition: args.definition,
    updated_by: args.userId,
    updated_at: new Date().toISOString(),
    change_source: args.source ?? "human",
    change_summary: args.summary ?? "Updated flow",
    change_commands: args.commands ?? [],
  }
  if (args.schemaVersion !== undefined) patch.schema_version = args.schemaVersion
  if (args.klaviyoFlowId !== undefined) patch.klaviyo_flow_id = args.klaviyoFlowId
  if (args.klaviyoStatus !== undefined) patch.klaviyo_status = args.klaviyoStatus
  if (args.klaviyoSyncedRevision !== undefined) patch.klaviyo_synced_revision = args.klaviyoSyncedRevision
  if (args.klaviyoContentChecksum !== undefined) patch.klaviyo_content_checksum = args.klaviyoContentChecksum
  if (args.klaviyoSyncedAt !== undefined) patch.klaviyo_synced_at = args.klaviyoSyncedAt
  if (args.klaviyoReplacedFlowId !== undefined) {
    patch.klaviyo_replaced_flow_id = args.klaviyoReplacedFlowId
  }
  if (args.klaviyoReplacedFlowStatus !== undefined) {
    patch.klaviyo_replaced_flow_status = args.klaviyoReplacedFlowStatus
  }
  let query = supabase
    .from("email_studio_flows")
    .update(patch)
    .eq("id", args.id)
  if (args.expectedRevision !== undefined) {
    query = query.eq("revision", args.expectedRevision)
  }
  const { data, error } = await query
    .select(SELECT)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data && args.expectedRevision !== undefined) throw new EmailStudioRevisionConflictError()
  if (!data) throw new Error("Could not save flow")
  return toRecord(data as Row)
}

export async function updateEmailStudioFlowKlaviyoSync(
  supabase: SupabaseClient,
  args: {
    id: string
    flowId: string
    status: string
    syncedRevision: number | null
    contentChecksum: string | null
    syncedAt: string | null
    replacedFlowId?: string | null
    replacedFlowStatus?: string | null
    userId: string
  },
): Promise<EmailStudioFlowRecord> {
  const patch: Record<string, unknown> = {
    klaviyo_flow_id: args.flowId,
    klaviyo_status: args.status,
    klaviyo_synced_revision: args.syncedRevision,
    klaviyo_content_checksum: args.contentChecksum,
    klaviyo_synced_at: args.syncedAt,
    updated_by: args.userId,
    updated_at: new Date().toISOString(),
  }
  if (args.replacedFlowId !== undefined) patch.klaviyo_replaced_flow_id = args.replacedFlowId
  if (args.replacedFlowStatus !== undefined) {
    patch.klaviyo_replaced_flow_status = args.replacedFlowStatus
  }
  const { data, error } = await supabase
    .from("email_studio_flows")
    .update(patch)
    .eq("id", args.id)
    .select(SELECT)
    .single()
  if (error || !data) throw new Error(error?.message ?? "Could not save Klaviyo flow sync state")
  return toRecord(data as Row)
}

export async function deleteEmailStudioFlow(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from("email_studio_flows").delete().eq("id", id)
  if (error) throw new Error(error.message)
}

type MessageRow = {
  id: string
  role: string
  content: string
  created_at: string
}

export async function listEmailStudioMessages(
  supabase: SupabaseClient,
  scope: "email" | "flow",
  scopeId: string,
): Promise<EmailStudioMessage[]> {
  const { data, error } = await supabase
    .from("email_studio_messages")
    .select("id, role, content, created_at")
    .eq("scope", scope)
    .eq("scope_id", scopeId)
    .order("created_at", { ascending: true })
    .limit(40)
  if (error) throw new Error(error.message)
  return ((data ?? []) as MessageRow[]).map((row) => ({
    id: row.id,
    role: row.role === "assistant" ? "assistant" : "user",
    content: row.content,
    createdAt: row.created_at,
  }))
}

export async function insertEmailStudioMessage(
  supabase: SupabaseClient,
  args: {
    scope: "email" | "flow"
    scopeId: string
    role: "user" | "assistant"
    content: string
    userId: string | null
  },
): Promise<void> {
  const { error } = await supabase.from("email_studio_messages").insert({
    scope: args.scope,
    scope_id: args.scopeId,
    role: args.role,
    content: args.content,
    created_by: args.userId,
  })
  if (error) throw new Error(error.message)
}
