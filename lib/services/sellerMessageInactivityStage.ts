import {
  SELLER_MESSAGE_REMINDER_DAYS,
  type SellerMessageReminderStage,
} from "@/lib/db/sellerMessageInactivity"

export function sellerMessageReminderCutoff(referenceTime: Date, days: number): Date {
  return new Date(referenceTime.getTime() - days * 24 * 60 * 60 * 1000)
}

/**
 * The milestone due for one unanswered buyer message.
 * Auto vacation (day 6 hide warning / day 7 hide) is disabled — sellers turn
 * vacation mode on themselves. Only the day-3 "are you still here?" reminder runs.
 */
export function resolveSellerMessageReminderStage(input: {
  buyerMessageAt: Date
  referenceTime: Date
  reminder3dAt: string | null
  warning6dAt: string | null
  vacationAppliedAt: string | null
}): SellerMessageReminderStage | null {
  if (input.vacationAppliedAt || input.warning6dAt || input.reminder3dAt) return null
  if (Number.isNaN(input.buyerMessageAt.getTime())) return null

  const at = input.buyerMessageAt.getTime()
  const day3 = sellerMessageReminderCutoff(
    input.referenceTime,
    SELLER_MESSAGE_REMINDER_DAYS,
  ).getTime()

  if (at < day3) return "day3"
  return null
}

export function sellerMessageReminderMessageKey(messageIds: string[]): string {
  return [...messageIds].map((id) => id.trim()).filter(Boolean).sort().join(",")
}
