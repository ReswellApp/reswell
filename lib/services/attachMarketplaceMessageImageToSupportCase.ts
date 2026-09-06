import { z } from "zod"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { getOrderSupportRequestById } from "@/lib/db/order-support"
import {
  getSupportCaseByOrderSupportId,
  insertSupportCaseEvent,
} from "@/lib/db/supportCases"
import { insertSupportCaseAttachments } from "@/lib/db/supportCaseAttachments"
import { SUPPORT_CASE_ATTACHMENTS_BUCKET } from "@/lib/validations/support-case-attachment"
import { parseMarketplaceMessageImageAttachment } from "@/lib/validations/marketplace-message-attachment"
import { supportEvidenceKindSchema } from "@/lib/validations/support-case-attachment"

const schema = z.object({
  message_id: z.string().uuid(),
  order_support_request_id: z.string().uuid(),
  evidence_kind: supportEvidenceKindSchema.optional(),
})

function extForMime(mime: string, fileName: string): string {
  const fromName = fileName.split(".").pop()?.toLowerCase()
  if (fromName && ["jpg", "jpeg", "png", "webp", "gif"].includes(fromName)) {
    return fromName === "jpeg" ? "jpg" : fromName
  }
  if (mime === "image/png") return "png"
  if (mime === "image/webp") return "webp"
  if (mime === "image/gif") return "gif"
  return "jpg"
}

export async function attachMarketplaceMessageImageToSupportCaseService(
  raw: unknown,
): Promise<{ success: true; attachment_id: string } | { error: string }> {
  const parsed = schema.safeParse(raw)
  if (!parsed.success) return { error: "Invalid input" }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Unauthorized" }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin, is_employee")
    .eq("id", user.id)
    .maybeSingle()

  if (!profile || (profile.is_admin !== true && profile.is_employee !== true)) {
    return { error: "Forbidden" }
  }

  const request = await getOrderSupportRequestById(
    supabase,
    parsed.data.order_support_request_id,
  )
  if (!request) return { error: "Support case not found" }

  const service = createServiceRoleClient()
  const { data: message, error: msgErr } = await service
    .from("messages")
    .select("id, metadata, conversation_id")
    .eq("id", parsed.data.message_id)
    .maybeSingle()

  if (msgErr || !message) return { error: "Message not found" }

  const image = parseMarketplaceMessageImageAttachment(message.metadata)
  if (!image) return { error: "That message has no photo attachment" }

  const { data: blob, error: dlErr } = await service.storage
    .from(image.bucket)
    .download(image.path)

  if (dlErr || !blob) {
    console.error("[attachMarketplaceMessageImageToSupportCase] download:", dlErr)
    return { error: "Could not download the photo from Messages" }
  }

  const bytes = Buffer.from(await blob.arrayBuffer())
  const ext = extForMime(image.mime_type, image.file_name)
  const storagePath = `${user.id}/${crypto.randomUUID()}.${ext}`

  const { error: upErr } = await service.storage
    .from(SUPPORT_CASE_ATTACHMENTS_BUCKET)
    .upload(storagePath, bytes, {
      contentType: image.mime_type,
      upsert: false,
    })

  if (upErr) {
    console.error("[attachMarketplaceMessageImageToSupportCase] upload:", upErr)
    return { error: "Could not save photo to the support case" }
  }

  const supportCase = await getSupportCaseByOrderSupportId(service, request.id)
  const inserted = await insertSupportCaseAttachments(service, {
    orderSupportRequestId: request.id,
    supportCaseId: supportCase?.id ?? null,
    uploadedBy: user.id,
    attachments: [
      {
        kind: "image",
        path: storagePath,
        file_name: image.file_name,
        mime_type: image.mime_type,
        size_bytes: image.size_bytes || bytes.length,
        width: image.width,
        height: image.height,
        evidence_kind: parsed.data.evidence_kind ?? "other",
      },
    ],
  })

  if (inserted.error || !inserted.data[0]) {
    void service.storage.from(SUPPORT_CASE_ATTACHMENTS_BUCKET).remove([storagePath])
    return { error: inserted.error?.message ?? "Could not attach photo to case" }
  }

  if (supportCase) {
    await insertSupportCaseEvent(service, {
      case_id: supportCase.id,
      actor_admin_id: user.id,
      event_type: "evidence_from_marketplace_message",
      payload: {
        message_id: parsed.data.message_id,
        attachment_id: inserted.data[0].id,
        file_name: image.file_name,
      },
    })
  }

  return { success: true, attachment_id: inserted.data[0].id }
}
