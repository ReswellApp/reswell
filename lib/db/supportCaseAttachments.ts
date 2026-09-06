import type { SupabaseClient } from "@supabase/supabase-js"
import {
  SUPPORT_CASE_ATTACHMENTS_BUCKET,
  type SupportCaseAttachmentInput,
} from "@/lib/validations/support-case-attachment"
import type { SupportEvidenceKind } from "@/lib/types/protectionClaimDesk"

export type SupportCaseAttachmentRow = {
  id: string
  order_support_request_id: string
  support_case_id: string | null
  uploaded_by: string
  evidence_kind: SupportEvidenceKind
  storage_path: string
  file_name: string
  mime_type: string
  size_bytes: number
  width: number | null
  height: number | null
  created_at: string
}

const ATTACHMENT_SELECT =
  "id, order_support_request_id, support_case_id, uploaded_by, evidence_kind, storage_path, file_name, mime_type, size_bytes, width, height, created_at"

function attachmentPathBelongsToUploader(path: string, userId: string): boolean {
  return path.startsWith(`${userId}/`)
}

export async function insertSupportCaseAttachments(
  supabase: SupabaseClient,
  args: {
    orderSupportRequestId: string
    supportCaseId?: string | null
    uploadedBy: string
    attachments: SupportCaseAttachmentInput[]
  },
): Promise<{ data: SupportCaseAttachmentRow[]; error: Error | null }> {
  if (args.attachments.length === 0) return { data: [], error: null }

  for (const a of args.attachments) {
    if (!attachmentPathBelongsToUploader(a.path, args.uploadedBy)) {
      return { data: [], error: new Error("Invalid attachment path") }
    }
  }

  const rows = args.attachments.map((a) => ({
    order_support_request_id: args.orderSupportRequestId,
    support_case_id: args.supportCaseId ?? null,
    uploaded_by: args.uploadedBy,
    evidence_kind: a.evidence_kind ?? "damage",
    storage_path: a.path,
    file_name: a.file_name,
    mime_type: a.mime_type,
    size_bytes: a.size_bytes,
    width: a.width ?? null,
    height: a.height ?? null,
  }))

  const { data, error } = await supabase
    .from("support_case_attachments")
    .insert(rows)
    .select(ATTACHMENT_SELECT)

  if (error) {
    return { data: [], error: new Error(error.message) }
  }
  return { data: (data ?? []) as SupportCaseAttachmentRow[], error: null }
}

export async function listSupportCaseAttachmentsForRequest(
  supabase: SupabaseClient,
  orderSupportRequestId: string,
): Promise<SupportCaseAttachmentRow[]> {
  const { data, error } = await supabase
    .from("support_case_attachments")
    .select(ATTACHMENT_SELECT)
    .eq("order_support_request_id", orderSupportRequestId)
    .order("created_at", { ascending: true })

  if (error) {
    console.warn("[support_case_attachments] list skipped:", error.message)
    return []
  }
  return (data ?? []) as SupportCaseAttachmentRow[]
}

export async function createSupportCaseAttachmentSignedUrls(
  supabase: SupabaseClient,
  attachments: SupportCaseAttachmentRow[],
  expiresInSeconds = 3600,
): Promise<Array<SupportCaseAttachmentRow & { signedUrl: string | null }>> {
  const out: Array<SupportCaseAttachmentRow & { signedUrl: string | null }> = []
  for (const row of attachments) {
    const { data, error } = await supabase.storage
      .from(SUPPORT_CASE_ATTACHMENTS_BUCKET)
      .createSignedUrl(row.storage_path, expiresInSeconds)
    out.push({
      ...row,
      signedUrl: error || !data?.signedUrl ? null : data.signedUrl,
    })
  }
  return out
}
