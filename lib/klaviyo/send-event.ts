/**
 * Server-only: Klaviyo Events API (private key).
 * Success is HTTP 202 (per Klaviyo docs) — treat any 2xx as OK.
 * @see https://developers.klaviyo.com/en/reference/create_event
 */

import "@/lib/klaviyo/bootstrap-env"
import { existsSync } from "node:fs"
import { join } from "node:path"

const KLAVIYO_EVENTS_URL = "https://a.klaviyo.com/api/events"
export const KLAVIYO_API_REVISION = "2026-01-15"

let klaviyoEnvDebugLogged = false
let klaviyoMissingKeyWarned = false

function logKlaviyoEnvDebugOnce(): void {
  if (klaviyoEnvDebugLogged) return
  klaviyoEnvDebugLogged = true
  if (process.env.NODE_ENV === "production") return

  const cwd = process.cwd()
  const envLocalPath = join(cwd, ".env.local")
  const hasEnvLocal = existsSync(envLocalPath)
  const raw = process.env.KLAVIYO_API_KEY
  const key = typeof raw === "string" ? raw.trim() : ""

  if (key.length > 0) {
    const tail = key.length > 4 ? key.slice(-4) : "****"
    console.log(
      `[klaviyo] env check: OK — KLAVIYO_API_KEY is readable (${key.length} chars, ends …${tail})`,
    )
  } else {
    console.warn(
      `[klaviyo] env check: FAIL — KLAVIYO_API_KEY missing or empty`,
    )
    console.warn(
      `[klaviyo] env check: cwd=${cwd} | .env.local on disk=${hasEnvLocal ? "yes" : "no"} (${envLocalPath})`,
    )
    console.warn(
      `[klaviyo] env check: typeof KLAVIYO_API_KEY=${typeof raw} (expect "string" after a restart)`,
    )
    console.warn(
      "[klaviyo] env check: Add one line: KLAVIYO_API_KEY=pk_... then save and restart `next dev`.",
    )
  }
}

export type KlaviyoProfileIds = {
  /** Supabase user id (recommended for logged-in users) */
  external_id?: string
  email?: string | null
  /** For anonymous traffic; Klaviyo accepts this as a profile identifier */
  anonymous_id?: string
}

export type SendKlaviyoServerEventInput = {
  metricName: string
  properties: Record<string, unknown>
  profile: KlaviyoProfileIds
  /** Dedupe key; omit to let Klaviyo default to one event/sec per profile metric */
  uniqueId?: string
  value?: number
  valueCurrency?: string
}

export type SendKlaviyoServerEventResult = {
  ok: boolean
  status: number
  skipped: boolean
  skipReason?: string
  detail: string
}

function hasProfileIdentifier(p: KlaviyoProfileIds): boolean {
  return Boolean(
    p.external_id?.trim() ||
      p.email?.trim() ||
      p.anonymous_id?.trim(),
  )
}

export async function sendKlaviyoServerEvent(
  input: SendKlaviyoServerEventInput,
): Promise<SendKlaviyoServerEventResult> {
  logKlaviyoEnvDebugOnce()
  const apiKey = process.env.KLAVIYO_API_KEY?.trim()
  if (!apiKey) {
    if (!klaviyoMissingKeyWarned) {
      klaviyoMissingKeyWarned = true
      console.warn(
        "[klaviyo] KLAVIYO_API_KEY is not set; Events API calls are skipped. Metrics such as Purchase Successful only appear in Klaviyo after at least one event is accepted.",
      )
    }
    return {
      ok: false,
      status: 0,
      skipped: true,
      skipReason: "KLAVIYO_API_KEY not set",
      detail: "",
    }
  }

  if (!hasProfileIdentifier(input.profile)) {
    console.warn(
      "[klaviyo] Event skipped:",
      input.metricName,
      "— no profile identifier (email, external_id, or anonymous_id)",
    )
    return {
      ok: false,
      status: 0,
      skipped: true,
      skipReason: "No profile identifier (email, external_id, or anonymous_id)",
      detail: "",
    }
  }

  const profileAttributes: Record<string, string> = {}
  if (input.profile.external_id?.trim()) {
    profileAttributes.external_id = input.profile.external_id.trim()
  }
  if (input.profile.email?.trim()) {
    profileAttributes.email = input.profile.email.trim()
  }
  if (input.profile.anonymous_id?.trim()) {
    profileAttributes.anonymous_id = input.profile.anonymous_id.trim()
  }

  const attrs: Record<string, unknown> = {
    properties: input.properties,
    metric: {
      data: {
        type: "metric",
        attributes: {
          name: input.metricName,
          service: "api",
        },
      },
    },
    profile: {
      data: {
        type: "profile",
        attributes: profileAttributes,
      },
    },
  }

  if (input.uniqueId) {
    attrs.unique_id = input.uniqueId
  }
  if (input.value !== undefined && typeof input.value === "number" && Number.isFinite(input.value)) {
    attrs.value = input.value
    attrs.value_currency = input.valueCurrency ?? "USD"
  }

  const body = {
    data: {
      type: "event",
      attributes: attrs,
    },
  }

  try {
    const res = await fetch(KLAVIYO_EVENTS_URL, {
      method: "POST",
      headers: {
        Authorization: `Klaviyo-API-Key ${apiKey}`,
        revision: KLAVIYO_API_REVISION,
        "Content-Type": "application/vnd.api+json",
        Accept: "application/vnd.api+json",
      },
      body: JSON.stringify(body),
    })

    const text = await res.text().catch(() => "")
    const ok = res.status >= 200 && res.status < 300

    if (!ok) {
      console.error(
        "[klaviyo] Event failed:",
        input.metricName,
        res.status,
        text.slice(0, 800),
      )
    } else if (process.env.NODE_ENV === "development") {
      console.log(
        `[klaviyo] Event accepted (${res.status}) metric="${input.metricName}"`,
      )
    }

    return {
      ok,
      status: res.status,
      skipped: false,
      detail: text.slice(0, 500),
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[klaviyo] Event fetch error:", input.metricName, e)
    return {
      ok: false,
      status: 0,
      skipped: false,
      detail: msg,
    }
  }
}
