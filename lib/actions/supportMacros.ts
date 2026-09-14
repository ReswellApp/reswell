"use server"

import { revalidatePath } from "next/cache"
import {
  createSupportMacroService,
  deleteSupportMacroService,
  getSupportMacroOrderService,
  listActiveSupportMacrosService,
  listSupportMacrosAdminService,
  updateSupportMacroService,
} from "@/lib/services/supportMacros"
import {
  createSupportMacroSchema,
  deleteSupportMacroSchema,
  supportMacroOrderIdSchema,
  updateSupportMacroSchema,
} from "@/lib/validations/supportMacros"

const MACRO_PATHS = ["/admin/support-macros", "/admin/contact-messages"] as const

function flattenZod(error: {
  flatten: () => { formErrors: string[]; fieldErrors: Record<string, string[] | undefined> }
}): string {
  const flat = error.flatten()
  const firstField = Object.values(flat.fieldErrors).find((msgs) => msgs && msgs.length > 0)
  return firstField?.[0] ?? flat.formErrors[0] ?? "Check the form and try again."
}

function revalidateMacroPaths() {
  for (const path of MACRO_PATHS) {
    revalidatePath(path)
  }
}

export async function listSupportMacrosAdminAction() {
  return listSupportMacrosAdminService()
}

export async function listActiveSupportMacrosAction() {
  return listActiveSupportMacrosService()
}

export async function getSupportMacroOrderAction(raw: unknown) {
  const parsed = supportMacroOrderIdSchema.safeParse(raw)
  if (!parsed.success) return { error: flattenZod(parsed.error) }
  return getSupportMacroOrderService(parsed.data.order_id)
}

export async function createSupportMacroAction(raw: unknown) {
  const parsed = createSupportMacroSchema.safeParse(raw)
  if (!parsed.success) return { error: flattenZod(parsed.error) }
  const result = await createSupportMacroService(parsed.data)
  if ("error" in result) return result
  revalidateMacroPaths()
  return result
}

export async function updateSupportMacroAction(raw: unknown) {
  const parsed = updateSupportMacroSchema.safeParse(raw)
  if (!parsed.success) return { error: flattenZod(parsed.error) }
  const result = await updateSupportMacroService(parsed.data)
  if ("error" in result) return result
  revalidateMacroPaths()
  return result
}

export async function deleteSupportMacroAction(raw: unknown) {
  const parsed = deleteSupportMacroSchema.safeParse(raw)
  if (!parsed.success) return { error: flattenZod(parsed.error) }
  const result = await deleteSupportMacroService(parsed.data)
  if ("error" in result) return result
  revalidateMacroPaths()
  return { success: true as const }
}
