import { listUserSupportCasesService } from "@/lib/services/supportCases"
import {
  isOpenSupportCaseLimitReached,
  OPEN_SUPPORT_CASE_LIMIT_REACHED,
} from "@/lib/utils/support-case-open-limit"

export {
  MAX_OPEN_USER_SUPPORT_CASES,
  OPEN_SUPPORT_CASE_LIMIT_REACHED,
  isOpenSupportCaseLimitReached,
} from "@/lib/utils/support-case-open-limit"

export async function rejectIfMemberHasOpenSupportCase(
  userId: string,
): Promise<{ ok: true } | { ok: false; error: string; existingId: string }> {
  const open = await listUserSupportCasesService(userId, "open")
  if (!isOpenSupportCaseLimitReached(open.length)) return { ok: true }
  const existing = open[0]
  if (!existing) return { ok: true }
  return { ok: false, error: OPEN_SUPPORT_CASE_LIMIT_REACHED, existingId: existing.id }
}
