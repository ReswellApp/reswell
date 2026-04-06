/**
 * Server-only: Klaviyo Events API — fires once per user (deduped by unique_id) so flows
 * can send a welcome email. Metric name: "Signed Up".
 */

import type { User } from "@supabase/supabase-js"

import { sendKlaviyoServerEvent } from "@/lib/klaviyo/send-event"

const FIRST_SESSION_MAX_MS = 120_000

/** True when this session likely reflects account creation (OAuth / PKCE), not a returning login. */
export function isProbableFirstAuthSession(user: User): boolean {
  const last = user.last_sign_in_at
  if (!last) return false
  const created = new Date(user.created_at).getTime()
  const lastSignIn = new Date(last).getTime()
  if (!Number.isFinite(created) || !Number.isFinite(lastSignIn)) return false
  return Math.abs(lastSignIn - created) <= FIRST_SESSION_MAX_MS
}

export function authProviderLabel(user: User): string {
  const ids = user.identities ?? []
  const providers = ids.map((i) => i.provider).filter(Boolean)
  if (providers.includes("google")) return "google"
  if (providers.includes("email")) return "email"
  const fromMeta =
    typeof user.app_metadata?.provider === "string"
      ? user.app_metadata.provider.trim()
      : ""
  return fromMeta || providers[0] || "unknown"
}

function displayNameFromUser(user: User): string {
  const m = user.user_metadata
  if (!m || typeof m !== "object") return ""
  const dn = m.display_name ?? m.full_name ?? m.name
  return typeof dn === "string" ? dn.trim() : ""
}

export type TrackKlaviyoWelcomeInput = {
  user: User
}

/**
 * Sends "Signed Up" to Klaviyo (no-op without KLAVIYO_API_KEY). Skips when the user has no email.
 */
export async function trackKlaviyoWelcome(
  input: TrackKlaviyoWelcomeInput,
): Promise<void> {
  const email = input.user.email?.trim() || null
  if (!email) return

  await sendKlaviyoServerEvent({
    metricName: "Signed Up",
    properties: {
      auth_provider: authProviderLabel(input.user),
      display_name: displayNameFromUser(input.user),
    },
    profile: {
      external_id: input.user.id,
      email,
    },
    uniqueId: `welcome-${input.user.id}`,
  })
}
