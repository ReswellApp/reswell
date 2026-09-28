"use server"

import { revalidatePath } from "next/cache"
import {
  applyEmailStudioCommandsService,
  listEmailStudioRevisionsService,
  resolveEmailStudioProposalService,
  restoreEmailStudioRevisionService,
} from "@/lib/services/emailStudioCommands"
import {
  applyEmailStudioCommandsSchema,
  emailStudioRevisionListSchema,
  resolveEmailStudioProposalSchema,
  restoreEmailStudioRevisionSchema,
} from "@/lib/validations/emailStudioCommands"

function flattenZod(error: {
  flatten: () => { formErrors: string[]; fieldErrors: Record<string, string[] | undefined> }
}): string {
  const flat = error.flatten()
  const firstField = Object.values(flat.fieldErrors).find((messages) => messages?.length)
  return firstField?.[0] ?? flat.formErrors[0] ?? "Check the changes and try again."
}

function revalidateStudio(scope: "email" | "flow", scopeId: string): void {
  revalidatePath("/admin/email-studio")
  if (scope === "email") {
    revalidatePath(`/admin/email-studio/${scopeId}`)
    return
  }
  revalidatePath("/admin/email-studio/flows")
  revalidatePath(`/admin/email-studio/flows/${scopeId}`)
}

export async function applyEmailStudioCommandsAction(raw: unknown) {
  const parsed = applyEmailStudioCommandsSchema.safeParse(raw)
  if (!parsed.success) return { error: flattenZod(parsed.error) }
  const result = await applyEmailStudioCommandsService(parsed.data)
  if ("error" in result) return result
  revalidateStudio(result.scope, result.data.id)
  return result
}

export async function listEmailStudioRevisionsAction(raw: unknown) {
  const parsed = emailStudioRevisionListSchema.safeParse(raw)
  if (!parsed.success) return { error: flattenZod(parsed.error) }
  return listEmailStudioRevisionsService(
    parsed.data.scope,
    parsed.data.scopeId,
    parsed.data.limit,
  )
}

export async function restoreEmailStudioRevisionAction(raw: unknown) {
  const parsed = restoreEmailStudioRevisionSchema.safeParse(raw)
  if (!parsed.success) return { error: flattenZod(parsed.error) }
  const result = await restoreEmailStudioRevisionService(parsed.data)
  if ("error" in result) return result
  revalidateStudio(result.scope, result.data.id)
  return result
}

export async function resolveEmailStudioProposalAction(raw: unknown) {
  const parsed = resolveEmailStudioProposalSchema.safeParse(raw)
  if (!parsed.success) return { error: flattenZod(parsed.error) }
  const result = await resolveEmailStudioProposalService(parsed.data)
  if ("error" in result) return result
  if (result.status === "accepted") revalidateStudio(result.scope, result.data.id)
  return result
}
