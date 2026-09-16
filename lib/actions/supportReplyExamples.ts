"use server"

import { revalidatePath } from "next/cache"
import {
  deleteAdminSupportReplyExampleService,
  getAdminSupportReplyRootPromptService,
  listAdminSupportReplyExamplesService,
  updateAdminSupportReplyExampleService,
  updateAdminSupportReplyRootPromptService,
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

export async function getSupportReplyRootPromptAction() {
  return getAdminSupportReplyRootPromptService()
}

export async function updateSupportReplyRootPromptAction(raw: unknown) {
  const result = await updateAdminSupportReplyRootPromptService(raw)
  if ("success" in result) revalidateExamples()
  return result
}
