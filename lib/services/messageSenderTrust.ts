import type { SupabaseClient } from "@supabase/supabase-js"
import {
  fetchMessageSenderTrustProfile,
  type MessageSenderTrustProfileRow,
  userHasCompletedPurchase,
} from "@/lib/db/messageSenderTrust"
import { createServiceRoleClient } from "@/lib/supabase/server"

export const MESSAGE_SENDER_TRUST_ACCOUNT_AGE_MS = 7 * 24 * 60 * 60 * 1000

export function isEstablishedMessageSender(params: {
  profile: MessageSenderTrustProfileRow
  hasCompletedPurchase: boolean
}): boolean {
  if (params.hasCompletedPurchase) return true

  if (params.profile.phone?.trim()) return true

  const createdMs = Date.parse(params.profile.createdAt)
  if (
    Number.isFinite(createdMs) &&
    Date.now() - createdMs >= MESSAGE_SENDER_TRUST_ACCOUNT_AGE_MS
  ) {
    return true
  }

  return false
}

export async function evaluateMessageSenderTrust(
  supabase: SupabaseClient,
  senderId: string,
  profile?: MessageSenderTrustProfileRow | null,
): Promise<{ isEstablished: boolean }> {
  const resolvedProfile = profile ?? (await fetchMessageSenderTrustProfile(supabase, senderId))
  if (!resolvedProfile) {
    return { isEstablished: false }
  }

  let service: SupabaseClient
  try {
    service = createServiceRoleClient()
  } catch {
    return {
      isEstablished: isEstablishedMessageSender({
        profile: resolvedProfile,
        hasCompletedPurchase: false,
      }),
    }
  }

  const hasCompletedPurchase = await userHasCompletedPurchase(service, senderId)
  if (hasCompletedPurchase === null) {
    return {
      isEstablished: isEstablishedMessageSender({
        profile: resolvedProfile,
        hasCompletedPurchase: false,
      }),
    }
  }

  return {
    isEstablished: isEstablishedMessageSender({
      profile: resolvedProfile,
      hasCompletedPurchase,
    }),
  }
}
