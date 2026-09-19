import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchSenderNewAccountFraudBanProfile } from "@/lib/db/accountRestrictions"
import { countPhishingFraudMessagesForSender } from "@/lib/db/fraudMessages"
import {
  messagePolicyCountsTowardPhishingBan,
  type MessagePolicyReasonCode,
} from "@/lib/messages/fraud-reason-codes"
import {
  NEW_ACCOUNT_FRAUD_BAN_REASON,
  isAccountNewerThanFraudBanWindow,
  shouldPermanentlyBanNewAccountForFraud,
} from "@/lib/messages/new-account-fraud-ban"
import { isPermanentRestrictionUntil } from "@/lib/messages/account-ban-errors"
import { banStoredAccessSignalsForUser } from "@/lib/services/accessSignals"
import { applyAdminAccountBan } from "@/lib/services/banUserAccount"

export type NewAccountFraudBanResult = {
  banned: boolean
}

/**
 * After a blocked phishing DM is recorded, permanently ban the sender (and
 * their IP / device) when they are under 24 hours old and this is at least
 * their third phishing / impersonation message. Phone and Venmo blocks never
 * reach this path.
 */
export async function maybeBanNewAccountAfterFraudMessage(
  supabase: SupabaseClient,
  senderId: string,
  reasonCode: MessagePolicyReasonCode,
): Promise<NewAccountFraudBanResult> {
  if (!messagePolicyCountsTowardPhishingBan(reasonCode)) {
    return { banned: false }
  }

  const profile = await fetchSenderNewAccountFraudBanProfile(supabase, senderId)
  if (!profile) return { banned: false }
  if (profile.isAdmin || profile.isEmployee) return { banned: false }
  if (isPermanentRestrictionUntil(profile.accountRestrictedUntil)) return { banned: false }
  if (!isAccountNewerThanFraudBanWindow(profile.createdAt)) return { banned: false }

  const count = await countPhishingFraudMessagesForSender(supabase, senderId)
  if (count == null) return { banned: false }

  if (
    !shouldPermanentlyBanNewAccountForFraud({
      accountCreatedAt: profile.createdAt,
      phishingMessageCount: count,
      latestReasonCode: reasonCode,
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

  try {
    await banStoredAccessSignalsForUser(supabase, senderId, NEW_ACCOUNT_FRAUD_BAN_REASON)
  } catch (error) {
    console.error("[newAccountFraudBan] access-signal ban failed:", senderId, error)
  }

  console.info("[newAccountFraudBan] permanently banned new phishing account:", senderId, {
    count,
  })
  return { banned: true }
}
