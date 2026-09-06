"use server"

import { revalidatePath } from "next/cache"
import { grantProtectionRepairCreditService } from "@/lib/services/protectionRepairCredit"
import {
  getProtectionClaimShippingContextService,
  updateProtectionCarrierClaimService,
} from "@/lib/services/protectionCarrierClaim"
import {
  createSupportCaseAttachmentSignedUrls,
  listSupportCaseAttachmentsForRequest,
} from "@/lib/db/supportCaseAttachments"
import { createClient } from "@/lib/supabase/server"

function revalidateClaimPaths(orderSupportRequestId: string) {
  revalidatePath("/admin/contact-messages")
  revalidatePath("/admin/order-support")
  revalidatePath("/admin/support/" + orderSupportRequestId)
  revalidatePath("/dashboard/support")
  revalidatePath(`/support/${orderSupportRequestId}`)
  revalidatePath(`/dashboard/support/order/${orderSupportRequestId}`)
}

export async function grantProtectionRepairCreditAction(raw: unknown) {
  const result = await grantProtectionRepairCreditService(raw)
  if ("error" in result) return { error: result.error }
  if (
    typeof raw === "object" &&
    raw !== null &&
    "order_support_request_id" in raw &&
    typeof (raw as { order_support_request_id: unknown }).order_support_request_id === "string"
  ) {
    revalidateClaimPaths((raw as { order_support_request_id: string }).order_support_request_id)
  }
  return result
}

export async function updateProtectionCarrierClaimAction(raw: unknown) {
  const result = await updateProtectionCarrierClaimService(raw)
  if ("error" in result) return { error: result.error }
  if (
    typeof raw === "object" &&
    raw !== null &&
    "order_support_request_id" in raw &&
    typeof (raw as { order_support_request_id: unknown }).order_support_request_id === "string"
  ) {
    revalidateClaimPaths((raw as { order_support_request_id: string }).order_support_request_id)
  }
  return { success: true as const }
}

export async function getProtectionClaimDeskAction(orderSupportRequestId: string) {
  const shipping = await getProtectionClaimShippingContextService(orderSupportRequestId)
  if ("error" in shipping) return { error: shipping.error }

  const supabase = await createClient()
  const attachments = await listSupportCaseAttachmentsForRequest(supabase, orderSupportRequestId)
  const withUrls = await createSupportCaseAttachmentSignedUrls(supabase, attachments)

  return {
    success: true as const,
    caseRow: shipping.caseRow,
    context: shipping.context,
    evidence: withUrls.map((a) => ({
      id: a.id,
      evidence_kind: a.evidence_kind,
      file_name: a.file_name,
      signedUrl: a.signedUrl,
      created_at: a.created_at,
    })),
  }
}
