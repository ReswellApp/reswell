import type { SupabaseClient } from "@supabase/supabase-js"
import { getAuthEmailForUserId } from "@/lib/klaviyo/auth-user-email"
import {
  fetchPurchasableFavoriteListingsForKlaviyo,
  fetchUsersEligibleForFavoritesDigest,
} from "@/lib/db/favoritesKlaviyo"
import {
  FAVORITES_DIGEST_MAX_ITEMS,
} from "@/lib/klaviyo/favorites-commerce-event"
import { trackKlaviyoFavoritesDigest } from "@/lib/klaviyo/track-favorites-digest"

const BATCH_SIZE = 8

export type ProcessKlaviyoFavoritesDigestSummary = {
  eligible: number
  emitted: number
  skipped: number
  failed: number
  errors: string[]
  digestWeekKey: string
}

function isoWeekKey(referenceTime: Date): string {
  const d = new Date(
    Date.UTC(referenceTime.getUTCFullYear(), referenceTime.getUTCMonth(), referenceTime.getUTCDate()),
  )
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`
}

export async function processKlaviyoFavoritesDigest(
  supabase: SupabaseClient,
  referenceTime: Date,
): Promise<ProcessKlaviyoFavoritesDigestSummary> {
  const digestWeekKey = isoWeekKey(referenceTime)
  const users = await fetchUsersEligibleForFavoritesDigest(supabase, {
    referenceTime,
    minDaysSinceLastDigest: 7,
  })

  const summary: ProcessKlaviyoFavoritesDigestSummary = {
    eligible: users.length,
    emitted: 0,
    skipped: 0,
    failed: 0,
    errors: [],
    digestWeekKey,
  }

  for (let offset = 0; offset < users.length; offset += BATCH_SIZE) {
    const slice = users.slice(offset, offset + BATCH_SIZE)
    const outcomes = await Promise.all(
      slice.map(async (user) => {
        const listings = await fetchPurchasableFavoriteListingsForKlaviyo(
          supabase,
          user.userId,
          FAVORITES_DIGEST_MAX_ITEMS,
        )
        if (listings.length === 0) {
          return { kind: "skipped" as const }
        }

        let email = user.email
        if (!email) {
          email = await getAuthEmailForUserId(user.userId)
        }

        const result = await trackKlaviyoFavoritesDigest({
          buyerUserId: user.userId,
          buyerEmail: email,
          displayName: user.displayName,
          listings,
          digestWeekKey,
        })

        if (result.ok) return { kind: "emitted" as const }
        if (result.skipped) return { kind: "skipped" as const }
        return {
          kind: "failed" as const,
          msg: `${user.userId}: Klaviyo ${result.status} — ${result.detail.slice(0, 200)}`,
        }
      }),
    )

    for (const outcome of outcomes) {
      if (outcome.kind === "emitted") summary.emitted += 1
      else if (outcome.kind === "skipped") summary.skipped += 1
      else {
        summary.failed += 1
        summary.errors.push(outcome.msg)
      }
    }
  }

  return summary
}
