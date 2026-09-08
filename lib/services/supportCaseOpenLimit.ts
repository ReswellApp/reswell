import { listUserSupportCasesService } from "@/lib/services/supportCases"

export const ALREADY_HAS_OPEN_SUPPORT_CASE =
  "You already have an open support request. Continue that conversation — you can start a new one after it’s closed."

export async function getLatestOpenUserSupportCaseService(
  userId: string,
): Promise<{ id: string; subject: string } | null> {
  const open = await listUserSupportCasesService(userId, "open")
  const latest = open[0]
  if (!latest) return null
  return { id: latest.id, subject: latest.subject }
}

export async function rejectIfMemberHasOpenSupportCase(
  userId: string,
): Promise<{ ok: true } | { ok: false; error: string; existingId: string }> {
  const existing = await getLatestOpenUserSupportCaseService(userId)
  if (!existing) return { ok: true }
  return { ok: false, error: ALREADY_HAS_OPEN_SUPPORT_CASE, existingId: existing.id }
}
