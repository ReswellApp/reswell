import { businessDayKeyFromMs } from "@/lib/utils/business-timezone"

export interface FollowedSellerNewListingAlertClaim {
  recipientId: string
  status: "granted" | "already_granted" | "capped"
}

/** America/Los_Angeles calendar day. The notification planner's day key is UTC; this alert uses the business timezone. */
export function followedSellerNewListingDayKey(now: Date = new Date()): string {
  return businessDayKeyFromMs(now.getTime())
}

export function followedSellerNewListingAlertMaySend(
  status: FollowedSellerNewListingAlertClaim["status"],
): boolean {
  return status === "granted" || status === "already_granted"
}

export function recipientsAllowedByListingAlertCap(
  claims: readonly FollowedSellerNewListingAlertClaim[],
): Set<string> {
  const allowed = new Set<string>()
  for (const claim of claims) {
    if (followedSellerNewListingAlertMaySend(claim.status)) allowed.add(claim.recipientId)
  }
  return allowed
}
