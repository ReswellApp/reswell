import type { SupabaseClient } from "@supabase/supabase-js"
import { pageUntilExhausted } from "@/lib/utils/page-until-exhausted"

const DELETE_CHUNK = 100

export type LiveChatSupportTicketPreview = {
  caseCount: number
  contactMessageCount: number
  cases: Array<{
    id: string
    case_number: string
    status: string
    subject: string
    created_at: string
  }>
  contactMessages: Array<{
    id: string
    support_status: string
    subject: string | null
    created_at: string
  }>
}

export type PurgeLiveChatSupportTicketsResult = {
  caseCount: number
  contactMessageCount: number
  deletedCases: number
  deletedContactMessages: number
}

async function listLiveChatSupportCaseIds(supabase: SupabaseClient): Promise<string[]> {
  const rows = await pageUntilExhausted<{ id: string }>(async (from, to) => {
    const { data, error } = await supabase
      .from("support_cases")
      .select("id")
      .eq("source_channel", "live_chat")
      .order("created_at", { ascending: true })
      .range(from, to)
    if (error) throw new Error(`Failed to list live-chat support cases: ${error.message}`)
    return (data ?? []) as Array<{ id: string }>
  })
  return rows.map((row) => row.id)
}

async function listLiveChatContactMessageIds(supabase: SupabaseClient): Promise<string[]> {
  const rows = await pageUntilExhausted<{ id: string }>(async (from, to) => {
    const { data, error } = await supabase
      .from("contact_messages")
      .select("id")
      .eq("source", "live_chat")
      .order("created_at", { ascending: true })
      .range(from, to)
    if (error) throw new Error(`Failed to list live-chat contact messages: ${error.message}`)
    return (data ?? []) as Array<{ id: string }>
  })
  return rows.map((row) => row.id)
}

async function deleteByIds(
  supabase: SupabaseClient,
  table: "support_cases" | "contact_messages",
  ids: string[],
): Promise<number> {
  let deleted = 0
  for (let i = 0; i < ids.length; i += DELETE_CHUNK) {
    const chunk = ids.slice(i, i + DELETE_CHUNK)
    const { error } = await supabase.from(table).delete().in("id", chunk)
    if (error) throw new Error(`Failed to delete ${table}: ${error.message}`)
    deleted += chunk.length
  }
  return deleted
}

export async function previewLiveChatSupportTickets(
  supabase: SupabaseClient,
): Promise<LiveChatSupportTicketPreview> {
  const [cases, contactMessages] = await Promise.all([
    pageUntilExhausted<LiveChatSupportTicketPreview["cases"][number]>(async (from, to) => {
      const { data, error } = await supabase
        .from("support_cases")
        .select("id, case_number, status, subject, created_at")
        .eq("source_channel", "live_chat")
        .order("created_at", { ascending: true })
        .range(from, to)
      if (error) throw new Error(`Failed to preview live-chat support cases: ${error.message}`)
      return (data ?? []) as LiveChatSupportTicketPreview["cases"]
    }),
    pageUntilExhausted<LiveChatSupportTicketPreview["contactMessages"][number]>(async (from, to) => {
      const { data, error } = await supabase
        .from("contact_messages")
        .select("id, support_status, subject, created_at")
        .eq("source", "live_chat")
        .order("created_at", { ascending: true })
        .range(from, to)
      if (error) throw new Error(`Failed to preview live-chat contact messages: ${error.message}`)
      return (data ?? []) as LiveChatSupportTicketPreview["contactMessages"]
    }),
  ])

  return {
    caseCount: cases.length,
    contactMessageCount: contactMessages.length,
    cases,
    contactMessages,
  }
}

/**
 * Hard-deletes support_cases + contact_messages created by live chat.
 * Live chat sessions stay; their ticket FKs null out.
 */
export async function purgeLiveChatSupportTickets(
  supabase: SupabaseClient,
): Promise<PurgeLiveChatSupportTicketsResult> {
  const [caseIds, contactMessageIds] = await Promise.all([
    listLiveChatSupportCaseIds(supabase),
    listLiveChatContactMessageIds(supabase),
  ])

  const deletedCases = await deleteByIds(supabase, "support_cases", caseIds)
  const deletedContactMessages = await deleteByIds(supabase, "contact_messages", contactMessageIds)

  return {
    caseCount: caseIds.length,
    contactMessageCount: contactMessageIds.length,
    deletedCases,
    deletedContactMessages,
  }
}
