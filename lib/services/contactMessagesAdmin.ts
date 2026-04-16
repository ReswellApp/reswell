import { createClient } from "@/lib/supabase/server"
import {
  updateContactMessageRow,
  type ContactMessageSupportStatus,
} from "@/lib/db/contactMessages"
import {
  updateContactMessageAdminSchema,
  type UpdateContactMessageAdminInput,
} from "@/lib/validations/contactMessagesAdmin"

function normalizeUpdatePayload(
  parsed: UpdateContactMessageAdminInput,
): {
  id: string
  support_status?: ContactMessageSupportStatus
  ticket_url?: string | null
  internal_notes?: string | null
} {
  const out: {
    id: string
    support_status?: ContactMessageSupportStatus
    ticket_url?: string | null
    internal_notes?: string | null
  } = { id: parsed.id }

  if (parsed.support_status !== undefined) {
    out.support_status = parsed.support_status
  }
  if (parsed.ticket_url !== undefined) {
    const t = parsed.ticket_url.trim()
    out.ticket_url = t === "" ? null : t
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

  const payload = normalizeUpdatePayload(parsed.data)
  const { error } = await updateContactMessageRow(supabase, payload)
  if (error) {
    console.error("updateContactMessageAdminService", error)
    return { error: "Failed to save" }
  }

  return { success: true }
}
