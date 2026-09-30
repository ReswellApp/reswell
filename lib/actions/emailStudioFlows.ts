"use server"

import { revalidatePath } from "next/cache"
import {
  createEmailStudioFlowService,
  deleteEmailStudioFlowService,
  openKlaviyoFlowInStudioService,
  publishEmailStudioFlowService,
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
  openKlaviyoFlowSchema,
  publishEmailStudioFlowSchema,
  pushEmailStudioFlowSchema,
  setEmailStudioFlowStatusSchema,
  updateEmailStudioFlowSchema,
} from "@/lib/validations/emailStudioFlow"
import {
  ASSISTANT_SCREENSHOT_MAX_BASE64_CHARS,
  ASSISTANT_SCREENSHOT_MAX_COUNT,
  ASSISTANT_SCREENSHOT_MEDIA_TYPES,
  assistantScreenshotRequest,
  decodeAssistantScreenshots,
} from "@/lib/email-studio/assistant-images"
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

export async function openKlaviyoFlowAction(raw: unknown) {
  const parsed = openKlaviyoFlowSchema.safeParse(raw)
  if (!parsed.success) return { error: flattenZod(parsed.error) }
  const result = await openKlaviyoFlowInStudioService(parsed.data.klaviyoFlowId)
  if ("error" in result) return result
  revalidateFlow(result.flowId)
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

export async function publishEmailStudioFlowAction(raw: unknown) {
  const parsed = publishEmailStudioFlowSchema.safeParse(raw)
  if (!parsed.success) return { error: flattenZod(parsed.error) }
  const result = await publishEmailStudioFlowService(
    parsed.data.id,
    parsed.data.confirmLive,
  )
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
  baseRevision: z.number().int().positive(),
  selectedBlockId: z.string().uuid().optional(),
  message: z.string().trim().max(4000),
  snapshot: z.string().max(20000),
  images: z.array(z.object({
    mediaType: z.enum(ASSISTANT_SCREENSHOT_MEDIA_TYPES),
    dataBase64: z.string().trim().min(32).max(ASSISTANT_SCREENSHOT_MAX_BASE64_CHARS),
  })).max(ASSISTANT_SCREENSHOT_MAX_COUNT).optional(),
}).superRefine((value, ctx) => {
  if (value.message.length > 0) return
  if (value.images && value.images.length > 0) return
  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    message: "Add a message or a screenshot.",
    path: ["message"],
  })
})

export async function askEmailStudioAssistantAction(raw: unknown) {
  const parsed = askSchema.safeParse(raw)
  if (!parsed.success) return { error: flattenZod(parsed.error) }
  const images = decodeAssistantScreenshots(parsed.data.images)
  if (!images.ok) return { error: images.error }
  const message = images.images.length > 0
    ? assistantScreenshotRequest(parsed.data.scope, parsed.data.message)
    : parsed.data.message
  const result = await askEmailStudioAssistantService({
    scope: parsed.data.scope,
    scopeId: parsed.data.scopeId,
    baseRevision: parsed.data.baseRevision,
    selectedBlockId: parsed.data.selectedBlockId,
    snapshot: parsed.data.snapshot,
    message,
    images: images.images,
  })
  if ("error" in result) return result
  if (result.flowId) revalidateFlow(result.flowId)
  revalidatePath(`/admin/email-studio/${parsed.data.scopeId}`)
  return result
}
