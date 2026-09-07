"use server"

import { listAdminSupportInboxService } from "@/lib/services/adminSupportInbox"

export async function listAdminSupportInboxAction() {
  return listAdminSupportInboxService()
}
