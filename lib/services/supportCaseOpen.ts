import type { SupabaseClient } from "@supabase/supabase-js"
import {
  insertSupportCase,
  insertSupportCaseMessage,
  type SupportCaseRow,
} from "@/lib/db/supportCases"
import { formatSupportCaseReference } from "@/lib/utils/support-case-display"

const WELCOME =
  "Thanks — we received this. Reply here anytime. We’ll also email you."

/** Create the case + opening customer message. Soft-fails if the table is missing. */
export async function createSupportCaseWithOpeningMessage(
  supabase: SupabaseClient,
  args: Parameters<typeof insertSupportCase>[1] & {
    body: string
    authorUserId?: string | null
  },
): Promise<SupportCaseRow | null> {
  const inserted = await insertSupportCase(supabase, args)
  if (!inserted.data) return null

  await insertSupportCaseMessage(supabase, {
    case_id: inserted.data.id,
    author_user_id: args.authorUserId ?? null,
    author_role: "customer",
    body: args.body,
  })
  await insertSupportCaseMessage(supabase, {
    case_id: inserted.data.id,
    author_role: "system",
    body: `${WELCOME} Case ${formatSupportCaseReference(inserted.data.id)}.`,
  })
  return inserted.data
}
