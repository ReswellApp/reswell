import type { SupabaseClient } from "@supabase/supabase-js"
import { requireAdminOrEmployee } from "@/lib/brands/admin-server"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { supportCaseMessageAttachmentMetadataSchema } from "@/lib/validations/support-case-attachment"

export type SupportCaseMessageAttachmentDownloadAuthResult =
  | {
      ok: true
      bucket: string
      path: string
      fileName: string
      mimeType: string
    }
  | { ok: false; error: string; status: number }

/**
 * Verifies the session may read the attachment for this help thread message.
 * Serve bytes via `/api/support/messages/[messageId]/attachment`.
 */
export async function authorizeSupportCaseMessageAttachmentDownload(
  messageId: string,
  sessionSupabase?: SupabaseClient,
): Promise<SupportCaseMessageAttachmentDownloadAuthResult> {
  const supabase = sessionSupabase ?? (await createClient())
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, error: "Sign in required", status: 401 }
  }

  const sr = createServiceRoleClient()
  const { data: msg, error: msgErr } = await sr
    .from("support_case_messages")
    .select("id, case_id, metadata")
    .eq("id", messageId)
    .maybeSingle()

  if (msgErr || !msg) {
    return { ok: false, error: "Message not found", status: 404 }
  }

  const meta = supportCaseMessageAttachmentMetadataSchema.safeParse(msg.metadata)
  if (!meta.success) {
    return { ok: false, error: "Not an attachment", status: 400 }
  }

  const { bucket, path, file_name: fileName, mime_type: mimeType } = meta.data.attachment

  const { data: supportCase } = await sr
    .from("support_cases")
    .select("requester_user_id")
    .eq("id", msg.case_id as string)
    .maybeSingle()

  if (!supportCase) {
    return { ok: false, error: "Message not found", status: 404 }
  }

  const isRequester = supportCase.requester_user_id === user.id
  if (!isRequester) {
    const gate = await requireAdminOrEmployee()
    if (!gate.ok) {
      return { ok: false, error: "Forbidden", status: 403 }
    }
  }

  return { ok: true, bucket, path, fileName, mimeType }
}
