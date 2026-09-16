import type { SupabaseClient } from "@supabase/supabase-js"
import { DEFAULT_SUPPORT_REPLY_ROOT_PROMPT } from "@/lib/llm/cs-agent"

export const SUPPORT_REPLY_ROOT_PROMPT_ID = "global"

export type SupportReplyRootPromptRow = {
  id: string
  body: string
  updated_by: string | null
  created_at: string
  updated_at: string
}

function asRow(data: unknown): SupportReplyRootPromptRow | null {
  if (!data || typeof data !== "object") return null
  const row = data as Record<string, unknown>
  if (typeof row.body !== "string") return null
  return {
    id: typeof row.id === "string" ? row.id : SUPPORT_REPLY_ROOT_PROMPT_ID,
    body: row.body,
    updated_by: typeof row.updated_by === "string" ? row.updated_by : null,
    created_at: typeof row.created_at === "string" ? row.created_at : "",
    updated_at: typeof row.updated_at === "string" ? row.updated_at : "",
  }
}

export async function getSupportReplyRootPrompt(
  supabase: SupabaseClient,
): Promise<SupportReplyRootPromptRow | null> {
  const { data, error } = await supabase
    .from("support_reply_root_prompt")
    .select("id, body, updated_by, created_at, updated_at")
    .eq("id", SUPPORT_REPLY_ROOT_PROMPT_ID)
    .maybeSingle()

  if (error) {
    console.warn("[support_reply_root_prompt] get skipped:", error.message)
    return null
  }
  return asRow(data)
}

export async function getSupportReplyRootPromptBody(supabase: SupabaseClient): Promise<string> {
  const row = await getSupportReplyRootPrompt(supabase)
  const body = row?.body.trim() ?? ""
  return body || DEFAULT_SUPPORT_REPLY_ROOT_PROMPT
}

export async function upsertSupportReplyRootPrompt(
  supabase: SupabaseClient,
  body: string,
  updatedBy: string | null,
): Promise<SupportReplyRootPromptRow | { error: string }> {
  const { data, error } = await supabase
    .from("support_reply_root_prompt")
    .upsert(
      {
        id: SUPPORT_REPLY_ROOT_PROMPT_ID,
        body,
        updated_by: updatedBy,
      },
      { onConflict: "id" },
    )
    .select("id, body, updated_by, created_at, updated_at")
    .maybeSingle()

  if (error) {
    console.error("[support_reply_root_prompt] upsert failed:", error.message)
    return { error: "Could not save the root prompt." }
  }
  const row = asRow(data)
  if (!row) return { error: "Could not save the root prompt." }
  return row
}
