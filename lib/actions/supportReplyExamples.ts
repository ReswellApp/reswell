"use server"

import { revalidatePath } from "next/cache"
import {
  deleteAdminSupportReplyExampleService,
  listAdminSupportReplyExamplesService,
  updateAdminSupportReplyExampleService,
} from "@/lib/services/supportReplyExamples"
import { SUPPORT_REPLY_EXAMPLES_PATH } from "@/lib/utils/support-reply-examples"

function revalidateExamples() {
  revalidatePath(SUPPORT_REPLY_EXAMPLES_PATH)
}

export async function listSupportReplyExamplesAction(raw: unknown) {
  return listAdminSupportReplyExamplesService(raw)
}

export async function updateSupportReplyExampleAction(raw: unknown) {
  const result = await updateAdminSupportReplyExampleService(raw)
  if ("success" in result) revalidateExamples()
  return result
}

export async function deleteSupportReplyExampleAction(raw: unknown) {
  const result = await deleteAdminSupportReplyExampleService(raw)
  if ("success" in result) revalidateExamples()
  return result
}
