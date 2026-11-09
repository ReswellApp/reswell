import type { PlannedDelivery } from "@/lib/services/notifications/plan"
import {
  defaultPushTopics,
  pushTopicForNotificationType,
  type PushTopic,
  type PushTopicFlags,
} from "@/lib/utils/push-topics"

export const EXPO_PUSH_CHUNK_SIZE = 100
export const EXPO_PUSH_TITLE_MAX = 80
export const EXPO_PUSH_BODY_MAX = 180

const EXPO_PUSH_TOKEN_RE = /^Expo(nent)?PushToken\[.+\]$/

export interface PushDelivery {
  userId: string
  title: string
  body: string
  data: Record<string, string>
  /** Omit on the profile test send. */
  topic?: PushTopic | null
}

export interface ExpoPushMessage {
  to: string
  title: string
  body: string
  sound: "default"
  data: Record<string, string>
}

export function isExpoPushToken(value: string): boolean {
  return EXPO_PUSH_TOKEN_RE.test(value.trim())
}

export function truncatePushText(value: string, max: number): string {
  const trimmed = value.trim().replace(/\s+/g, " ")
  if (trimmed.length <= max) return trimmed
  if (max <= 1) return trimmed.slice(0, max)
  return `${trimmed.slice(0, max - 1).trimEnd()}…`
}

export function compactPushData(data: Record<string, string | null | undefined>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(data)) {
    const trimmed = value?.trim()
    if (trimmed) out[key] = trimmed
  }
  return out
}

export function pushDeliveriesFromPlanned(rows: PlannedDelivery[]): PushDelivery[] {
  const deliveries: PushDelivery[] = []
  for (const item of rows) {
    if (!item.lockScreen) continue
    const title = truncatePushText(item.row.title, EXPO_PUSH_TITLE_MAX)
    const body = truncatePushText(item.row.body, EXPO_PUSH_BODY_MAX)
    if (!title || !body) continue
    deliveries.push({
      userId: item.row.userId,
      title,
      body,
      topic: pushTopicForNotificationType(item.row.type),
      data: compactPushData({
        kind: "notification",
        type: item.row.type,
        href: item.row.href,
        listing_id: item.row.listingId,
        offer_id: offerIdFromPushMetadata(item.row.metadata),
      }),
    })
  }
  return deliveries
}

export function messagePushDelivery(input: {
  receiverUserId: string
  conversationId: string
  listingId?: string | null
  senderName?: string | null
  message: string
}): PushDelivery | null {
  const userId = input.receiverUserId.trim()
  const conversationId = input.conversationId.trim()
  if (!userId || !conversationId) return null
  const sender = input.senderName?.trim() || "Someone"
  const preview = truncatePushText(input.message, EXPO_PUSH_BODY_MAX) || "Sent you a message"
  return {
    userId,
    title: "New message",
    body: `${sender}: ${preview}`,
    topic: "messages",
    data: compactPushData({
      kind: "message",
      conversation_id: conversationId,
      listing_id: input.listingId,
    }),
  }
}

export function expoPushMessagesForDeliveries(
  deliveries: PushDelivery[],
  tokens: Array<{ user_id: string; expo_push_token: string }>,
  topicsByUser: Map<string, PushTopicFlags>,
): ExpoPushMessage[] {
  const byUser = new Map<string, string[]>()
  for (const row of tokens) {
    if (!isExpoPushToken(row.expo_push_token)) continue
    const list = byUser.get(row.user_id) ?? []
    list.push(row.expo_push_token.trim())
    byUser.set(row.user_id, list)
  }

  const messages: ExpoPushMessage[] = []
  for (const delivery of deliveries) {
    const flags = topicsByUser.get(delivery.userId) ?? defaultPushTopics()
    if (delivery.topic && flags[delivery.topic] === false) continue
    if (!delivery.topic && !Object.values(flags).some(Boolean)) continue
    const userTokens = byUser.get(delivery.userId)
    if (!userTokens?.length) continue
    for (const token of userTokens) {
      messages.push({
        to: token,
        title: delivery.title,
        body: delivery.body,
        sound: "default",
        data: delivery.data,
      })
    }
  }
  return messages
}

export function tokensToDisableFromTickets(
  messages: ExpoPushMessage[],
  tickets: unknown,
): string[] {
  if (!Array.isArray(tickets)) return []
  const expired: string[] = []
  for (let i = 0; i < tickets.length; i += 1) {
    const ticket = tickets[i]
    if (!isRecord(ticket) || ticket.status !== "error") continue
    const details = isRecord(ticket.details) ? ticket.details : null
    if (details?.error !== "DeviceNotRegistered") continue
    const token = messages[i]?.to
    if (token) expired.push(token)
  }
  return expired
}

export function chunkExpoPushMessages(messages: ExpoPushMessage[]): ExpoPushMessage[][] {
  const chunks: ExpoPushMessage[][] = []
  for (let i = 0; i < messages.length; i += EXPO_PUSH_CHUNK_SIZE) {
    chunks.push(messages.slice(i, i + EXPO_PUSH_CHUNK_SIZE))
  }
  return chunks
}

function offerIdFromPushMetadata(metadata: Record<string, unknown> | undefined): string | null {
  const raw = metadata?.offerId
  return typeof raw === "string" && raw.trim() ? raw.trim() : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
