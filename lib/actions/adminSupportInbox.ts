"use server"

import { listAdminSupportInboxQuerySchema } from "@/lib/validations/adminSupportInbox"
import {
  getAdminSupportInboxItemService,
  listAdminSupportInboxService,
} from "@/lib/services/adminSupportInbox"

export async function listAdminSupportInboxAction(raw: unknown = {}) {
  const parsed = listAdminSupportInboxQuerySchema.safeParse(raw ?? {})
  if (!parsed.success) {
    return { error: "Invalid inbox query." }
  }
  return listAdminSupportInboxService(parsed.data)
}

export async function getAdminSupportInboxItemAction(rawId: unknown) {
  if (typeof rawId !== "string" || rawId.trim().length === 0) {
    return { error: "Missing case." }
  }
  return getAdminSupportInboxItemService(rawId.trim())
}
