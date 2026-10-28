import { insertSupportCaseMessage, resolveSupportCaseByAnyId } from "@/lib/db/supportCases"
import { isLiveChatSupportChannel } from "@/lib/utils/support-ticket-display"
import { scheduleSupportReplyDraft } from "@/lib/services/supportReplyDraft"
import { touchSupportCaseAfterMessage } from "@/lib/db/supportCases"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { verifyStorageObjectExists } from "@/lib/supabase/storage-object-exists"
import {
  SUPPORT_CASE_ATTACHMENTS_BUCKET,
  composeSupportCaseMediaMessageBody,
  supportCaseMessageAttachmentMetadataSchema,
  supportCaseMessageImageAttachmentSchema,
  type SupportCaseMessageImageAttachment,
} from "@/lib/validations/support-case-attachment"

export type SendSupportCaseMediaMessageResult =
  | {
      ok: true
      message: {
        id: string
        case_id: string
        body: string
        created_at: string
      }
    }
  | { ok: false; error: string; status?: number }

function attachmentPathBelongsToUploader(path: string, userId: string): boolean {
  return path.startsWith(`${userId}/`) && path.length > userId.length + 1
}

async function removeOrphanAttachment(path: string): Promise<void> {
  const service = createServiceRoleClient()
  const { error } = await service.storage.from(SUPPORT_CASE_ATTACHMENTS_BUCKET).remove([path])
  if (error) {
    console.error("[sendSupportCaseMediaMessage] orphan cleanup:", error.message)
  }
}

export async function sendSupportCaseMediaMessage(input: {
  caseId: string
  senderId: string
  attachment: Omit<SupportCaseMessageImageAttachment, "bucket">
  caption?: string | null
}): Promise<SendSupportCaseMediaMessageResult> {
  const attachmentParsed = supportCaseMessageImageAttachmentSchema.safeParse({
    ...input.attachment,
    bucket: SUPPORT_CASE_ATTACHMENTS_BUCKET,
  })
  if (!attachmentParsed.success) {
    return { ok: false, error: "Invalid attachment", status: 400 }
  }

  const attachment = attachmentParsed.data
  if (!attachmentPathBelongsToUploader(attachment.path, input.senderId)) {
    return { ok: false, error: "Invalid attachment path", status: 400 }
  }

  const service = createServiceRoleClient()
  const row = await resolveSupportCaseByAnyId(service, input.caseId)
  if (!row || row.requester_user_id !== input.senderId || isLiveChatSupportChannel(row.source_channel)) {
    return { ok: false, error: "Case not found.", status: 404 }
  }
  if (row.status === "resolved") {
    return { ok: false, error: "This case is closed. Open a new request if you still need help.", status: 400 }
  }

  const attachmentExists = await verifyStorageObjectExists(SUPPORT_CASE_ATTACHMENTS_BUCKET, attachment.path)
  if (!attachmentExists) {
    return { ok: false, error: "Attachment not found in storage", status: 400 }
  }

  const defaultBody = composeSupportCaseMediaMessageBody()
  const trimmedCaption = input.caption?.trim() ?? ""
  const body = (trimmedCaption || defaultBody).slice(0, 4000)

  const metadata = { attachment }
  const parsedMeta = supportCaseMessageAttachmentMetadataSchema.safeParse(metadata)
  if (!parsedMeta.success) {
    await removeOrphanAttachment(attachment.path)
    return { ok: false, error: "Invalid metadata", status: 500 }
  }

  const posted = await insertSupportCaseMessage(service, {
    case_id: row.id,
    author_user_id: input.senderId,
    author_role: "customer",
    body,
    metadata: parsedMeta.data,
  })
  if (posted.error || !posted.id) {
    await removeOrphanAttachment(attachment.path)
    return { ok: false, error: "Could not send your photo.", status: 500 }
  }

  const { data: inserted, error: readErr } = await service
    .from("support_case_messages")
    .select("id, body, created_at")
    .eq("id", posted.id)
    .maybeSingle()

  if (readErr || !inserted) {
    return { ok: false, error: "Could not send your photo.", status: 500 }
  }

  await touchSupportCaseAfterMessage(service, {
    id: row.id,
    preview: body,
    status: row.status === "waiting_on_you" ? "in_progress" : undefined,
  })
  scheduleSupportReplyDraft(row.id)

  return {
    ok: true,
    message: {
      id: inserted.id as string,
      case_id: row.id,
      body: inserted.body as string,
      created_at: inserted.created_at as string,
    },
  }
}
