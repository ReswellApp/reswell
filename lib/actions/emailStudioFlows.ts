"use server"

import { revalidatePath } from "next/cache"
import {
  createEmailStudioFlowService,
  deleteEmailStudioFlowService,
  pushEmailStudioFlowService,
  setEmailStudioFlowStatusService,
  updateEmailStudioFlowService,
} from "@/lib/services/emailStudioFlows"
import {
  askEmailStudioAssistantService,
} from "@/lib/services/emailStudioAssistant"
import {
  createEmailStudioFlowSchema,
  emailStudioFlowIdSchema,
  pushEmailStudioFlowSchema,
  setEmailStudioFlowStatusSchema,
  updateEmailStudioFlowSchema,
} from "@/lib/validations/emailStudioFlow"
import { z } from "zod"

function flattenZod(error: {
  flatten: () => { formErrors: string[]; fieldErrors: Record<string, string[] | undefined> }
}): string {
  const flat = error.flatten()
  const firstField = Object.values(flat.fieldErrors).find((msgs) => msgs && msgs.length > 0)
  return firstField?.[0] ?? flat.formErrors[0] ?? "Check the form and try again."
}

function revalidateFlow(id?: string) {
  revalidatePath("/admin/email-studio")
  revalidatePath("/admin/email-studio/flows")
  if (id) revalidatePath(`/admin/email-studio/flows/${id}`)
}

export async function createEmailStudioFlowAction(raw: unknown) {
  const parsed = createEmailStudioFlowSchema.safeParse(raw)
  if (!parsed.success) return { error: flattenZod(parsed.error) }
  const result = await createEmailStudioFlowService(parsed.data.name)
  if ("error" in result) return result
  revalidateFlow(result.data.id)
  return result
}

export async function updateEmailStudioFlowAction(raw: unknown) {
  const parsed = updateEmailStudioFlowSchema.safeParse(raw)
  if (!parsed.success) return { error: flattenZod(parsed.error) }
  const result = await updateEmailStudioFlowService(parsed.data)
  if ("error" in result) return result
  revalidateFlow(result.data.id)
  return result
}

export async function deleteEmailStudioFlowAction(raw: unknown) {
  const parsed = emailStudioFlowIdSchema.safeParse(raw)
  if (!parsed.success) return { error: flattenZod(parsed.error) }
  const result = await deleteEmailStudioFlowService(parsed.data.id)
  if ("error" in result) return result
  revalidateFlow()
  return result
}

export async function pushEmailStudioFlowAction(raw: unknown) {
  const parsed = pushEmailStudioFlowSchema.safeParse(raw)
  if (!parsed.success) return { error: flattenZod(parsed.error) }
  const result = await pushEmailStudioFlowService(parsed.data.id, parsed.data.replace)
  if ("error" in result) return result
  revalidateFlow(parsed.data.id)
  return result
}

export async function setEmailStudioFlowStatusAction(raw: unknown) {
  const parsed = setEmailStudioFlowStatusSchema.safeParse(raw)
  if (!parsed.success) return { error: flattenZod(parsed.error) }
  const result = await setEmailStudioFlowStatusService(
    parsed.data.id,
    parsed.data.status,
    parsed.data.confirmLive,
  )
  if ("error" in result) return result
  revalidateFlow(parsed.data.id)
  return result
}

const askSchema = z.object({
  scope: z.enum(["email", "flow"]),
  scopeId: z.string().uuid(),
  message: z.string().trim().min(1).max(4000),
  snapshot: z.string().max(20000),
})

export async function askEmailStudioAssistantAction(raw: unknown) {
  const parsed = askSchema.safeParse(raw)
  if (!parsed.success) return { error: flattenZod(parsed.error) }
  const result = await askEmailStudioAssistantService(parsed.data)
  if ("error" in result) return result
  if (result.flowId) revalidateFlow(result.flowId)
  revalidatePath(`/admin/email-studio/${parsed.data.scopeId}`)
  return result
}
