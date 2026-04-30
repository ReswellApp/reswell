import type { SupabaseClient, User } from "@supabase/supabase-js"

import { subscribeKlaviyoProfileEmailMarketing } from "@/lib/klaviyo/subscribe-profile-email-marketing"
import { sendKlaviyoServerEvent } from "@/lib/klaviyo/send-event"

export type TrackKlaviyoNewAccountCreatedOptions = {
  /** When set, loads `profiles.display_name` for the event (session must be on this client). */
  supabaseForProfile?: SupabaseClient
}

const OAUTH_NEW_ACCOUNT_WINDOW_MS = 10 * 60 * 1000

function parseFirstLastFromUser(user: User): {
  first_name: string
  last_name: string
} {
  const meta = user.user_metadata ?? {}
  let first =
    typeof meta.given_name === "string" ? meta.given_name.trim() : ""
  let last =
    typeof meta.family_name === "string" ? meta.family_name.trim() : ""
  const full =
    (typeof meta.full_name === "string" && meta.full_name.trim()) ||
    (typeof meta.name === "string" && meta.name.trim()) ||
    ""
  if (!first && !last && full) {
    const parts = full.split(/\s+/).filter(Boolean)
    first = parts[0] ?? ""
    last = parts.length > 1 ? parts.slice(1).join(" ") : ""
  }
  return { first_name: first, last_name: last }
}

function signupMethodFromUser(user: User): string {
  const am = user.app_metadata ?? {}
  const providers = am.providers
  if (Array.isArray(providers) && providers.length > 0) {
    return String(providers[0])
  }
  if (typeof am.provider === "string" && am.provider.trim()) {
    return am.provider.trim()
  }
  return "email"
}

/** Stable segmentation value for Klaviyo (flows, liquid `event.signup_channel`). */
export type KlaviyoSignupChannel = "google" | "email_password" | "oauth_other"

export function signupChannelFromUser(user: User): KlaviyoSignupChannel {
  const raw = signupMethodFromUser(user).toLowerCase()
  if (raw === "google") return "google"
  if (raw === "email") return "email_password"
  return "oauth_other"
}

/**
 * OAuth (and similar) first session: `created_at` is fresh so we do not fire for returning users.
 */
export function shouldTrackKlaviyoNewAccountForOAuthSession(user: User): boolean {
  const created = new Date(user.created_at).getTime()
  return Number.isFinite(created) && Date.now() - created < OAUTH_NEW_ACCOUNT_WINDOW_MS
}

/**
 * Klaviyo metric **"New Account Created"** — use in a flow to send a welcome email.
 * Deduped per user via `uniqueId` if multiple hooks run for the same account.
 *
 * **30‑day inactive re‑engagement (build in Klaviyo, no extra app code required):**
 * 1. Flow trigger: Metric → **New Account Created**.
 * 2. **Time delay** 30 days.
 * 3. **Conditional split** — treat as “active” if they engaged while in the flow, e.g. they
 *    performed **at least once** any of **Viewed Site Page**, **Viewed Sell Page**,
 *    **Viewed Boards Page**, or commerce metrics (**Listing**, **Added to Cart**,
 *    **Purchase Successful**, etc.), with timeframe **since starting this flow** (Klaviyo:
 *    profile activity / conditional split wording varies by UI).
 * 4. Send the recovery email only on the branch where they **have not** met that activity.
 *
 * Page views already post from `POST /api/integrations/klaviyo/page-view` for logged‑in users.
 *
 * Also calls Klaviyo **Subscribe Profiles** so the profile has email marketing consent
 * (`SUBSCRIBED`) where your Klaviyo list/account opt-in settings allow immediate consent.
 */
export async function trackKlaviyoNewAccountCreated(
  user: User,
  options?: TrackKlaviyoNewAccountCreatedOptions,
): Promise<void> {
  const authEmail = user.email?.trim() || null
  if (!user.id?.trim() && !authEmail) return

  let profileDisplayName: string | null = null
  let profileEmail: string | null = null
  if (options?.supabaseForProfile) {
    const { data } = await options.supabaseForProfile
      .from("profiles")
      .select("display_name, email")
      .eq("id", user.id)
      .maybeSingle()
    profileDisplayName =
      typeof data?.display_name === "string" ? data.display_name.trim() : null
    profileEmail =
      typeof data?.email === "string" && data.email.trim()
        ? data.email.trim()
        : null
  }

  /** Klaviyo profile + event: prefer `profiles.email`, same as public profile record; else Auth email. */
  const recipientEmail = profileEmail || authEmail

  const meta = user.user_metadata ?? {}
  const fromMeta =
    typeof meta.display_name === "string" ? meta.display_name.trim() : ""
  const displayName = profileDisplayName || fromMeta || ""

  const { first_name, last_name } = parseFirstLastFromUser(user)
  const fullNameFromMeta =
    (typeof meta.full_name === "string" && meta.full_name.trim()) ||
    (typeof meta.name === "string" && meta.name.trim()) ||
    ""
  const avatarUrl =
    (typeof meta.avatar_url === "string" && meta.avatar_url.trim()) ||
    (typeof meta.picture === "string" && meta.picture.trim()) ||
    ""

  const time = new Date().toISOString()

  const result = await sendKlaviyoServerEvent({
    metricName: "New Account Created",
    profile: {
      external_id: user.id,
      email: recipientEmail,
    },
    properties: {
      time,
      email: recipientEmail ?? "",
      user_id: user.id,
      first_name,
      last_name,
      display_name: displayName,
      full_name:
        fullNameFromMeta ||
        [first_name, last_name].filter(Boolean).join(" ").trim(),
      phone: user.phone?.trim() ?? "",
      avatar_url: avatarUrl,
      signup_method: signupMethodFromUser(user),
      signup_channel: signupChannelFromUser(user),
      account_created_at: user.created_at,
      email_confirmed_at: user.email_confirmed_at ?? null,
      last_sign_in_at: user.last_sign_in_at ?? null,
    },
    uniqueId: `new-account-created-${user.id}`,
  })

  if (result.skipped && result.skipReason) {
    console.warn("[klaviyo] New Account Created skipped:", result.skipReason)
  }

  if (recipientEmail) {
    void subscribeKlaviyoProfileEmailMarketing({
      email: recipientEmail,
      externalId: user.id,
    }).then((sub) => {
      if (sub.skipped && sub.skipReason) {
        console.warn("[klaviyo] Email subscribe skipped:", sub.skipReason)
      } else if (!sub.ok) {
        console.warn(
          "[klaviyo] Email subscribe failed:",
          sub.status,
          sub.detail.slice(0, 200),
        )
      }
    })
  }
}
