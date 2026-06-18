/**
 * Server-only: upsert Klaviyo profile identifiers before SMS consent subscribe.
 * Ensures Message Sent events (external_id) and subscribe jobs hit the same profile.
 *
 * @see https://developers.klaviyo.com/en/reference/create_profile
 */

import "@/lib/klaviyo/bootstrap-env"
import { KLAVIYO_API_REVISION } from "@/lib/klaviyo/send-event"

const PROFILES_URL = "https://a.klaviyo.com/api/profiles/"

export type EnsureKlaviyoProfileForSmsResult = {
  ok: boolean
  status: number
  skipped: boolean
  skipReason?: string
  detail: string
}

export async function ensureKlaviyoProfileForSms(input: {
  externalId: string
  email?: string | null
  phoneNumber: string
}): Promise<EnsureKlaviyoProfileForSmsResult> {
  const apiKey = process.env.KLAVIYO_API_KEY?.trim()
  if (!apiKey) {
    return {
      ok: false,
      status: 0,
      skipped: true,
      skipReason: "KLAVIYO_API_KEY not set",
      detail: "",
    }
  }

  const externalId = input.externalId.trim()
  const phoneNumber = input.phoneNumber.trim()
  const email = input.email?.trim()

  if (!externalId || !phoneNumber) {
    return {
      ok: false,
      status: 0,
      skipped: true,
      skipReason: "Missing external_id or phone_number",
      detail: "",
    }
  }

  const attributes: Record<string, string> = {
    external_id: externalId,
    phone_number: phoneNumber,
  }
  if (email) {
    attributes.email = email
  }

  try {
    const res = await fetch(PROFILES_URL, {
      method: "POST",
      headers: {
        Authorization: `Klaviyo-API-Key ${apiKey}`,
        revision: KLAVIYO_API_REVISION,
        Accept: "application/vnd.api+json",
        "Content-Type": "application/vnd.api+json",
      },
      body: JSON.stringify({
        data: {
          type: "profile",
          attributes,
        },
      }),
    })

    const text = await res.text().catch(() => "")
    // 409 = profile already exists for one of the identifiers — safe to continue.
    const ok = (res.status >= 200 && res.status < 300) || res.status === 409

    if (!ok) {
      console.error("[klaviyo] ensure profile for SMS failed:", res.status, text.slice(0, 800))
    }

    return {
      ok,
      status: res.status,
      skipped: false,
      detail: text.slice(0, 500),
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[klaviyo] ensure profile for SMS fetch error:", e)
    return {
      ok: false,
      status: 0,
      skipped: false,
      detail: msg,
    }
  }
}
