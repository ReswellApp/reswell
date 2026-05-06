import type { SupabaseClient } from "@supabase/supabase-js"
import { getAnyConversationBetweenUsers } from "@/lib/db/conversations"
import { createServiceRoleClient } from "@/lib/supabase/server"

export type AdminMarketplaceProfilePickerRow = {
  id: string
  display_name: string | null
  email: string | null
  avatar_url: string | null
}

function sanitizeIlikeTerm(raw: string): string {
  return raw.trim().replace(/[%_\\]/g, "").slice(0, 200)
}

export async function searchProfilesForAdminMessaging(
  searchRaw: string,
  limit: number,
): Promise<{ rows: AdminMarketplaceProfilePickerRow[]; error?: string }> {
  const term = sanitizeIlikeTerm(searchRaw)
  if (term.length < 2) {
    return { rows: [] }
  }

  const supabase = createServiceRoleClient()
  const pattern = `%${term}%`
  const lim = Math.min(limit, 50)

  const [byName, byEmail] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, display_name, email, avatar_url")
      .ilike("display_name", pattern)
      .order("display_name", { ascending: true })
      .limit(lim),
    supabase
      .from("profiles")
      .select("id, display_name, email, avatar_url")
      .ilike("email", pattern)
      .order("display_name", { ascending: true })
      .limit(lim),
  ])

  if (byName.error) {
    console.error("[searchProfilesForAdminMessaging] display_name", byName.error)
    return { rows: [], error: "Could not search users" }
  }
  if (byEmail.error) {
    console.error("[searchProfilesForAdminMessaging] email", byEmail.error)
    return { rows: [], error: "Could not search users" }
  }

  const byId = new Map<string, AdminMarketplaceProfilePickerRow>()
  for (const row of [...(byName.data ?? []), ...(byEmail.data ?? [])]) {
    if (row?.id) {
      byId.set(row.id, row as AdminMarketplaceProfilePickerRow)
    }
  }

  const rows = Array.from(byId.values())
    .sort((a, b) =>
      (a.display_name ?? "").localeCompare(b.display_name ?? "", undefined, { sensitivity: "base" }),
    )
    .slice(0, lim)

  return { rows }
}

export async function startStaffOutboundMarketplaceConversation(input: {
  supabase: SupabaseClient
  staffUserId: string
  targetUserId: string
  initialMessage: string | null | undefined
}): Promise<
  | { ok: true; conversationId: string; createdNewConversation: boolean }
  | { ok: false; error: string; status: number }
> {
  const { supabase, staffUserId, targetUserId } = input

  if (staffUserId === targetUserId) {
    return { ok: false, error: "Choose a user other than yourself", status: 400 }
  }

  const svc = createServiceRoleClient()
  const { data: targetProfile, error: targetErr } = await svc
    .from("profiles")
    .select("id")
    .eq("id", targetUserId)
    .maybeSingle()

  if (targetErr || !targetProfile) {
    return { ok: false, error: "User not found", status: 404 }
  }

  const existing = await getAnyConversationBetweenUsers(supabase, staffUserId, targetUserId)

  if (existing) {
    const body = input.initialMessage?.trim()
    if (body) {
      const { error: msgErr } = await supabase.from("messages").insert({
        conversation_id: existing.id,
        sender_id: staffUserId,
        content: body.slice(0, 8000),
      })
      if (msgErr) {
        console.error("[startStaffOutboundMarketplaceConversation] message on existing thread:", msgErr)
        return { ok: false, error: "Could not send message", status: 500 }
      }
    }
    return { ok: true, conversationId: existing.id, createdNewConversation: false }
  }

  const { data: created, error: convErr } = await supabase
    .from("conversations")
    .insert({
      buyer_id: staffUserId,
      seller_id: targetUserId,
      listing_id: null,
    })
    .select("id")
    .single()

  if (convErr || !created?.id) {
    console.error("[startStaffOutboundMarketplaceConversation] insert conv:", convErr)
    return { ok: false, error: "Could not start conversation", status: 500 }
  }

  const conversationId = created.id as string
  const body = input.initialMessage?.trim()

  if (body) {
    const { error: msgErr } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: staffUserId,
      content: body.slice(0, 8000),
    })
    if (msgErr) {
      console.error("[startStaffOutboundMarketplaceConversation] insert msg:", msgErr)
      return { ok: false, error: "Conversation started but the message could not be sent", status: 500 }
    }
  }

  return { ok: true, conversationId, createdNewConversation: true }
}
