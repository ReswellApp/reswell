import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { requireAdminOrEmployee } from "@/lib/brands/admin-server"
import {
  marketplaceMessageAttachmentMetadataSchema,
  type MarketplaceMessageAttachment,
} from "@/lib/validations/marketplace-message-attachment"

export type MarketplaceAttachmentDownloadAuthResult =
  | {
      ok: true
      bucket: string
      path: string
      fileName: string
      mimeType: string
      attachmentKind: MarketplaceMessageAttachment["kind"]
    }
  | { ok: false; error: string; status: number }

/**
 * Verifies the session may read the attachment for this message and returns storage coordinates.
 * Does not expose Supabase URLs — serve bytes via `/api/messages/[messageId]/attachment`.
 */
export async function authorizeMarketplaceAttachmentDownload(
  messageId: string,
): Promise<MarketplaceAttachmentDownloadAuthResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, error: "Sign in required", status: 401 }
  }

  const sr = createServiceRoleClient()
  const { data: msg, error: msgErr } = await sr
    .from("messages")
    .select("id, conversation_id, metadata")
    .eq("id", messageId)
    .maybeSingle()

  if (msgErr || !msg) {
    return { ok: false, error: "Message not found", status: 404 }
  }

  const meta = marketplaceMessageAttachmentMetadataSchema.safeParse(msg.metadata)
  if (!meta.success) {
    return { ok: false, error: "Not an attachment", status: 400 }
  }

  const { bucket, path, file_name: fileName, mime_type: mimeType, kind } = meta.data.attachment

  const { data: conv } = await supabase
    .from("conversations")
    .select("id")
    .eq("id", msg.conversation_id as string)
    .maybeSingle()

  if (!conv) {
    const gate = await requireAdminOrEmployee()
    if (!gate.ok) {
      return { ok: false, error: "Forbidden", status: 403 }
    }
  }

  return { ok: true, bucket, path, fileName, mimeType, attachmentKind: kind }
}

/** @deprecated Use authorizeMarketplaceAttachmentDownload */
export async function authorizeMarketplacePdfAttachmentDownload(messageId: string) {
  return authorizeMarketplaceAttachmentDownload(messageId)
}
