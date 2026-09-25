"use server"

import { revalidatePath } from "next/cache"
import {
  createEmailStudioService,
  deleteEmailStudioService,
  duplicateEmailStudioService,
  pushEmailStudioToKlaviyoService,
  saveEmailStudioTemplateService,
  updateEmailStudioService,
} from "@/lib/services/emailStudio"
import {
  createEmailStudioSchema,
  emailStudioIdSchema,
  saveEmailStudioTemplateSchema,
  updateEmailStudioSchema,
} from "@/lib/validations/emailStudio"

function flattenZod(error: {
  flatten: () => { formErrors: string[]; fieldErrors: Record<string, string[] | undefined> }
}): string {
  const flat = error.flatten()
  const firstField = Object.values(flat.fieldErrors).find((msgs) => msgs && msgs.length > 0)
  return firstField?.[0] ?? flat.formErrors[0] ?? "Check the form and try again."
}

function revalidateStudio(id?: string) {
  revalidatePath("/admin/email-studio")
  if (id) revalidatePath(`/admin/email-studio/${id}`)
}

export async function createEmailStudioAction(raw: unknown) {
  const parsed = createEmailStudioSchema.safeParse(raw)
  if (!parsed.success) return { error: flattenZod(parsed.error) }
  const result = await createEmailStudioService(parsed.data)
  if ("error" in result) return result
  revalidateStudio(result.data.id)
  return result
}

export async function updateEmailStudioAction(raw: unknown) {
  const parsed = updateEmailStudioSchema.safeParse(raw)
  if (!parsed.success) return { error: flattenZod(parsed.error) }
  const result = await updateEmailStudioService(parsed.data)
  if ("error" in result) return result
  revalidateStudio(result.data.id)
  return result
}

export async function deleteEmailStudioAction(raw: unknown) {
  const parsed = emailStudioIdSchema.safeParse(raw)
  if (!parsed.success) return { error: flattenZod(parsed.error) }
  const result = await deleteEmailStudioService(parsed.data.id)
  if ("error" in result) return result
  revalidateStudio()
  return result
}

export async function duplicateEmailStudioAction(raw: unknown) {
  const parsed = emailStudioIdSchema.safeParse(raw)
  if (!parsed.success) return { error: flattenZod(parsed.error) }
  const result = await duplicateEmailStudioService(parsed.data.id)
  if ("error" in result) return result
  revalidateStudio(result.data.id)
  return result
}

export async function saveEmailStudioTemplateAction(raw: unknown) {
  const parsed = saveEmailStudioTemplateSchema.safeParse(raw)
  if (!parsed.success) return { error: flattenZod(parsed.error) }
  const result = await saveEmailStudioTemplateService(parsed.data.id, parsed.data.name)
  if ("error" in result) return result
  revalidateStudio()
  return result
}

export async function pushEmailStudioToKlaviyoAction(raw: unknown) {
  const parsed = emailStudioIdSchema.safeParse(raw)
  if (!parsed.success) return { error: flattenZod(parsed.error) }
  const result = await pushEmailStudioToKlaviyoService(parsed.data.id)
  if ("error" in result) return result
  revalidateStudio(parsed.data.id)
  return result
}
