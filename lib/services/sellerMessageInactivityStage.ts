import {
  SELLER_MESSAGE_INACTIVITY_DAYS,
  SELLER_MESSAGE_REMINDER_DAYS,
  SELLER_MESSAGE_WARNING_DAYS,
  type SellerMessageReminderStage,
} from "@/lib/db/sellerMessageInactivity"

export function sellerMessageReminderCutoff(referenceTime: Date, days: number): Date {
  return new Date(referenceTime.getTime() - days * 24 * 60 * 60 * 1000)
}

/**
 * The milestone due for one unanswered buyer message.
 * A message strictly older than 7 days is day 7 even when day 3 and day 6 were missed.
 * A message already reminded for its current band returns null until the next band.
 */
export function resolveSellerMessageReminderStage(input: {
  buyerMessageAt: Date
  referenceTime: Date
  reminder3dAt: string | null
  warning6dAt: string | null
  vacationAppliedAt: string | null
}): SellerMessageReminderStage | null {
  if (input.vacationAppliedAt) return null
  if (Number.isNaN(input.buyerMessageAt.getTime())) return null

  const at = input.buyerMessageAt.getTime()
  const day7 = sellerMessageReminderCutoff(
    input.referenceTime,
    SELLER_MESSAGE_INACTIVITY_DAYS,
  ).getTime()
  const day6 = sellerMessageReminderCutoff(
    input.referenceTime,
    SELLER_MESSAGE_WARNING_DAYS,
  ).getTime()
  const day3 = sellerMessageReminderCutoff(
    input.referenceTime,
    SELLER_MESSAGE_REMINDER_DAYS,
  ).getTime()

  if (at < day7) return "day7"
  if (at < day6) return input.warning6dAt ? null : "day6"
  if (at < day3) return input.reminder3dAt ? null : "day3"
  return null
}

export function sellerMessageReminderMessageKey(messageIds: string[]): string {
  return [...messageIds].map((id) => id.trim()).filter(Boolean).sort().join(",")
}
