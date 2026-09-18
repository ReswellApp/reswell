import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchSenderNewAccountFraudBanProfile } from "@/lib/db/accountRestrictions"
import { countBlockingFraudMessagesForSender } from "@/lib/db/fraudMessages"
import {
  NEW_ACCOUNT_FRAUD_BAN_REASON,
  isAccountNewerThanFraudBanWindow,
  shouldPermanentlyBanNewAccountForFraud,
} from "@/lib/messages/new-account-fraud-ban"
import { isPermanentRestrictionUntil } from "@/lib/messages/account-ban-errors"
import { applyAdminAccountBan } from "@/lib/services/banUserAccount"

export type NewAccountFraudBanResult = {
  banned: boolean
}

/**
 * After a blocked scam DM is recorded, permanently ban the sender when they
 * are under 24 hours old and this is at least their third blocked scam message.
 */
export async function maybeBanNewAccountAfterFraudMessage(
  supabase: SupabaseClient,
  senderId: string,
): Promise<NewAccountFraudBanResult> {
  const profile = await fetchSenderNewAccountFraudBanProfile(supabase, senderId)
  if (!profile) return { banned: false }
  if (profile.isAdmin || profile.isEmployee) return { banned: false }
  if (isPermanentRestrictionUntil(profile.accountRestrictedUntil)) return { banned: false }
  if (!isAccountNewerThanFraudBanWindow(profile.createdAt)) return { banned: false }

  const count = await countBlockingFraudMessagesForSender(supabase, senderId)
  if (count == null) return { banned: false }

  if (
    !shouldPermanentlyBanNewAccountForFraud({
      accountCreatedAt: profile.createdAt,
      blockingFraudMessageCount: count,
    })
  ) {
    return { banned: false }
  }

  const banned = await applyAdminAccountBan({
    userId: senderId,
    banned: true,
    reason: NEW_ACCOUNT_FRAUD_BAN_REASON,
  })

  if (!banned.ok) {
    console.error("[newAccountFraudBan] ban failed:", senderId, banned.error)
    return { banned: false }
  }

  console.info("[newAccountFraudBan] permanently banned new account:", senderId, { count })
  return { banned: true }
}
