import { createClient } from "@/lib/supabase/server"
import { getContactMessageRowById, type ContactMessageRow } from "@/lib/db/contactMessages"
import { resolveSupportRecipientUserId } from "@/lib/services/resolveSupportRecipientUser"

export type ContactMessageTicketAdminView = {
  ticket: ContactMessageRow
  supportUserId: string | null
}

async function requireStaffContactMessageAccess(): Promise<
  | { ok: false; error: string }
  | { ok: true; supabase: Awaited<ReturnType<typeof createClient>> }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, error: "Unauthorized" }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin, is_employee")
    .eq("id", user.id)
    .maybeSingle()

  if (!profile || (profile.is_admin !== true && profile.is_employee !== true)) {
    return { ok: false, error: "Forbidden" }
  }

  return { ok: true, supabase }
}

export async function getContactMessageTicketAdminService(
  ticketId: string,
): Promise<{ data: ContactMessageTicketAdminView } | { error: string }> {
  const gate = await requireStaffContactMessageAccess()
  if (!gate.ok) {
    return { error: gate.error }
  }

  const ticket = await getContactMessageRowById(gate.supabase, ticketId)
  if (!ticket) {
    return { error: "Not found" }
  }

  const resolvedSupport = await resolveSupportRecipientUserId()
  const supportUserId = resolvedSupport.ok ? resolvedSupport.userId : null

  return {
    data: {
      ticket,
      supportUserId,
    },
  }
}
