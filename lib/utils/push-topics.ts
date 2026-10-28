import type { NotificationType } from "@/lib/services/notifications/catalog"

export const PUSH_TOPICS = ["messages", "offers", "saves", "follows", "orders"] as const

export type PushTopic = (typeof PUSH_TOPICS)[number]

export type PushTopicFlags = Record<PushTopic, boolean>

export interface PushPreferenceRow {
  push_opt_in?: boolean | null
  push_messages?: boolean | null
  push_offers?: boolean | null
  push_saves?: boolean | null
  push_follows?: boolean | null
  push_orders?: boolean | null
}

const ALL_OFF: PushTopicFlags = {
  messages: false,
  offers: false,
  saves: false,
  follows: false,
  orders: false,
}

const ALL_ON: PushTopicFlags = {
  messages: true,
  offers: true,
  saves: true,
  follows: true,
  orders: true,
}

export function defaultPushTopics(): PushTopicFlags {
  return { ...ALL_ON }
}

/** Master-off users keep every topic off until they turn one back on. */
export function effectivePushTopics(row: PushPreferenceRow | null | undefined): PushTopicFlags {
  if (!row) return { ...ALL_ON }
  if (row.push_opt_in === false) return { ...ALL_OFF }
  return {
    messages: row.push_messages !== false,
    offers: row.push_offers !== false,
    saves: row.push_saves !== false,
    follows: row.push_follows !== false,
    orders: row.push_orders !== false,
  }
}

export function anyPushTopicEnabled(flags: PushTopicFlags): boolean {
  return PUSH_TOPICS.some((topic) => flags[topic])
}

export function pushTopicForNotificationType(type: NotificationType): PushTopic {
  if (type.startsWith("offer_")) return "offers"
  if (type.startsWith("listing_saved")) return "saves"
  if (type.includes("followed")) return "follows"
  return "orders"
}

export function pushPreferenceColumns(flags: PushTopicFlags): PushPreferenceRow {
  return {
    push_opt_in: anyPushTopicEnabled(flags),
    push_messages: flags.messages,
    push_offers: flags.offers,
    push_saves: flags.saves,
    push_follows: flags.follows,
    push_orders: flags.orders,
  }
}
