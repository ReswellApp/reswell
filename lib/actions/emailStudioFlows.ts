"use server"

import { revalidatePath } from "next/cache"
import { askEmailStudioAssistantService } from "@/lib/services/emailStudioAssistant"
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

const FLOW_BUILDING_DISABLED = {
  error: "Flow building is no longer available in Email Studio. Build the flow in Klaviyo and use Reswell for its email templates.",
} as const

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
  if (parsed.data.scope === "flow") return FLOW_BUILDING_DISABLED
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
  revalidatePath(`/admin/email-studio/${parsed.data.scopeId}`)
  return result
}
