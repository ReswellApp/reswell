import type { SupabaseClient } from "@supabase/supabase-js"
import { blankFlowDefinition } from "@/lib/email-studio/flow-definition"
import type { EmailStudioFlowDefinition, EmailStudioFlowRecord, EmailStudioMessage } from "@/lib/types/emailStudioFlow"
import { emailStudioFlowDefinitionSchema } from "@/lib/validations/emailStudioFlow"

const SELECT = "id, name, notes, definition, klaviyo_flow_id, klaviyo_status, created_at, updated_at"

type Row = {
  id: string
  name: string
  notes: string
  definition: unknown
  klaviyo_flow_id: string | null
  klaviyo_status: string
  created_at: string
  updated_at: string
}

function toRecord(row: Row): EmailStudioFlowRecord {
  const parsed = emailStudioFlowDefinitionSchema.safeParse(row.definition)
  return {
    id: row.id,
    name: row.name,
    notes: row.notes,
    definition: parsed.success ? parsed.data : blankFlowDefinition(),
    klaviyoFlowId: row.klaviyo_flow_id,
    klaviyoStatus: row.klaviyo_status,
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
  args: { name: string; definition: EmailStudioFlowDefinition; userId: string },
): Promise<EmailStudioFlowRecord> {
  const { data, error } = await supabase
    .from("email_studio_flows")
    .insert({
      name: args.name,
      notes: "",
      definition: args.definition,
      created_by: args.userId,
      updated_by: args.userId,
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
  },
): Promise<EmailStudioFlowRecord> {
  const patch: Record<string, unknown> = {
    name: args.name,
    notes: args.notes,
    definition: args.definition,
    updated_by: args.userId,
    updated_at: new Date().toISOString(),
  }
  if (args.klaviyoFlowId !== undefined) patch.klaviyo_flow_id = args.klaviyoFlowId
  if (args.klaviyoStatus !== undefined) patch.klaviyo_status = args.klaviyoStatus
  const { data, error } = await supabase
    .from("email_studio_flows")
    .update(patch)
    .eq("id", args.id)
    .select(SELECT)
    .single()
  if (error) throw new Error(error.message)
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
