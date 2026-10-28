import { after } from "next/server"
import {
  disablePushTokens,
  listActivePushTokensForUsers,
  getPushTopicFlagsForUsers,
} from "@/lib/db/pushTokens"
import type { PlannedDelivery } from "@/lib/services/notifications/plan"
import {
  chunkExpoPushMessages,
  expoPushMessagesForDeliveries,
  messagePushDelivery,
  pushDeliveriesFromPlanned,
  tokensToDisableFromTickets,
  type ExpoPushMessage,
  type PushDelivery,
} from "@/lib/services/push-payload"
import { createServiceRoleClient } from "@/lib/supabase/server"

export const EXPO_PUSH_SEND_URL = "https://exp.host/--/api/v2/push/send"

export {
  isExpoPushToken,
  messagePushDelivery,
  pushDeliveriesFromPlanned,
} from "@/lib/services/push-payload"

export function schedulePushForPlannedDeliveries(rows: PlannedDelivery[]): void {
  const deliveries = pushDeliveriesFromPlanned(rows)
  if (deliveries.length === 0) return
  schedulePushWork(() => sendPushDeliveries(deliveries))
}

export function scheduleNewMessagePush(input: {
  receiverUserId: string
  conversationId: string
  listingId?: string | null
  senderName?: string | null
  message: string
}): void {
  const delivery = messagePushDelivery(input)
  if (!delivery) return
  schedulePushWork(() => sendPushDeliveries([delivery]))
}

export async function sendPushDeliveries(deliveries: PushDelivery[]): Promise<number> {
  if (deliveries.length === 0) return 0
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) return 0

  const userIds = [...new Set(deliveries.map((delivery) => delivery.userId))]
  const supabase = createServiceRoleClient()
  const [tokens, topicsByUser] = await Promise.all([
    listActivePushTokensForUsers(supabase, userIds),
    getPushTopicFlagsForUsers(supabase, userIds),
  ])
  const messages = expoPushMessagesForDeliveries(deliveries, tokens, topicsByUser)
  if (messages.length === 0) return 0

  const expired: string[] = []
  for (const chunk of chunkExpoPushMessages(messages)) {
    const tickets = await postExpoPushChunk(chunk)
    expired.push(...tokensToDisableFromTickets(chunk, tickets))
  }
  if (expired.length > 0) {
    await disablePushTokens(supabase, expired)
  }
  return messages.length
}

function schedulePushWork(work: () => Promise<void>): void {
  const run = () =>
    work().catch((error) => {
      console.error("[push] send failed", {
        timestamp: new Date().toISOString(),
        message: error instanceof Error ? error.message : String(error),
      })
    })
  try {
    after(run)
  } catch {
    void run()
  }
}

async function postExpoPushChunk(messages: ExpoPushMessage[]): Promise<unknown> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Accept-encoding": "gzip, deflate",
    "Content-Type": "application/json",
  }
  const accessToken = process.env.EXPO_ACCESS_TOKEN?.trim()
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`

  const response = await fetch(EXPO_PUSH_SEND_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(messages),
  })
  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(`Expo push HTTP ${response.status}`)
  }
  if (!isRecord(body)) return null
  return body.data
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
