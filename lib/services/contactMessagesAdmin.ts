import { createClient } from "@/lib/supabase/server"
import {
  getContactMessageRowById,
  updateContactMessageRow,
  type ContactMessageSupportStatus,
} from "@/lib/db/contactMessages"
import {
  updateContactMessageAdminSchema,
  type UpdateContactMessageAdminInput,
} from "@/lib/validations/contactMessagesAdmin"
import { resolveSupportRecipientUserId } from "@/lib/services/resolveSupportRecipientUser"
import { insertSupportStatusMessageAsSupportUser } from "@/lib/services/supportTicketThreadNotifications"

function normalizeUpdatePayload(
  parsed: UpdateContactMessageAdminInput,
): {
  id: string
  support_status?: ContactMessageSupportStatus
  internal_notes?: string | null
} {
  const out: {
    id: string
    support_status?: ContactMessageSupportStatus
    internal_notes?: string | null
  } = { id: parsed.id }

  if (parsed.support_status !== undefined) {
    out.support_status = parsed.support_status
  }
  if (parsed.internal_notes !== undefined) {
    const n = parsed.internal_notes.trim()
    out.internal_notes = n === "" ? null : parsed.internal_notes
  }
  return out
}

export async function updateContactMessageAdminService(
  raw: unknown,
): Promise<{ success: true } | { error: string }> {
  const parsed = updateContactMessageAdminSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: "Invalid input" }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: "Unauthorized" }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin, is_employee")
    .eq("id", user.id)
    .maybeSingle()

  if (!profile || (profile.is_admin !== true && profile.is_employee !== true)) {
    return { error: "Forbidden" }
  }

  const existing = await getContactMessageRowById(supabase, parsed.data.id)
  if (!existing) {
    return { error: "Not found" }
  }

  const payload = normalizeUpdatePayload(parsed.data)
  const { error } = await updateContactMessageRow(supabase, payload)
  if (error) {
    console.error("updateContactMessageAdminService", error)
    return { error: "Failed to save" }
  }

  const statusChanged =
    payload.support_status !== undefined && payload.support_status !== existing.support_status

  if (
    statusChanged &&
    existing.support_conversation_id &&
    existing.source === "messages_support"
  ) {
    const resolved = await resolveSupportRecipientUserId()
    if (resolved.ok) {
      await insertSupportStatusMessageAsSupportUser({
        conversationId: existing.support_conversation_id,
        supportUserId: resolved.userId,
        status: payload.support_status!,
        ticketId: existing.id,
      })
    }
  }

  return { success: true }
}
