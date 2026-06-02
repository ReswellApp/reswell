/**
 * Server-only: Meta Conversions API (CAPI) sender.
 *
 * Sends server-side events to the Graph API to back up the browser pixel (resilient to ad
 * blockers / ITP). When a browser event and a server event share the same `event_name` +
 * `event_id`, Meta deduplicates them — so every server event here MUST reuse the same
 * `eventId` the browser pixel fired with (see {@link file://./event-id.ts}).
 *
 * PII (email, phone, external id) is SHA-256 hashed per Meta's requirements before it leaves
 * the server. `fbp`, `fbc`, IP and user-agent are sent raw (Meta hashes/handles those).
 *
 * @see https://developers.facebook.com/docs/marketing-api/conversions-api
 */

import "server-only"

import { createHash } from "node:crypto"

import { getMetaPixelId } from "@/lib/meta/pixel-config"

const DEFAULT_GRAPH_API_VERSION = "v21.0"

function getAccessToken(): string | null {
  const raw = process.env.META_CONVERSIONS_API_ACCESS_TOKEN?.trim()
  return raw ? raw : null
}

function getGraphApiVersion(): string {
  const raw = process.env.META_GRAPH_API_VERSION?.trim()
  return raw && /^v\d+\.\d+$/.test(raw) ? raw : DEFAULT_GRAPH_API_VERSION
}

function getTestEventCode(): string | null {
  const raw = process.env.META_TEST_EVENT_CODE?.trim()
  return raw ? raw : null
}

/** CAPI is only attempted when both a pixel id and an access token are configured. */
export function isMetaCapiEnabled(): boolean {
  return Boolean(getMetaPixelId() && getAccessToken())
}

/**
 * True when `META_TEST_EVENT_CODE` is set. Callers that seed synthetic events (e.g. the admin
 * test-purchase tool) gate on this so those events only ever route to Events Manager → Test
 * Events and never count as live conversions.
 */
export function isMetaTestEventCodeConfigured(): boolean {
  return Boolean(getTestEventCode())
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex")
}

function hashEmail(email: string): string | null {
  const normalized = email.trim().toLowerCase()
  return normalized ? sha256(normalized) : null
}

function hashPhone(phone: string): string | null {
  // Meta expects digits only (country code included), no symbols or leading zeros stripping.
  const digits = phone.replace(/[^0-9]/g, "")
  return digits ? sha256(digits) : null
}

function hashExternalId(externalId: string): string | null {
  const normalized = externalId.trim().toLowerCase()
  return normalized ? sha256(normalized) : null
}

export type MetaUserData = {
  email?: string | null
  phone?: string | null
  /** Stable first-party identifier (e.g. Supabase user id). Hashed before sending. */
  externalId?: string | null
  /** `_fbp` cookie value (sent raw). */
  fbp?: string | null
  /** `_fbc` cookie value (sent raw). */
  fbc?: string | null
  clientIpAddress?: string | null
  clientUserAgent?: string | null
}

export type MetaCustomData = {
  value?: number | null
  currency?: string | null
  contentIds?: string[] | null
  contentType?: string | null
  orderId?: string | null
  numItems?: number | null
}

export type MetaServerEvent = {
  eventName: "Purchase" | "AddToCart" | "ViewContent" | "InitiateCheckout"
  /** MUST match the browser pixel `eventID` for the same logical event (dedup). */
  eventId: string
  eventTime?: number
  eventSourceUrl?: string | null
  actionSource?: "website" | "physical_store" | "system_generated"
  userData?: MetaUserData
  customData?: MetaCustomData
}

function buildUserDataPayload(userData: MetaUserData | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (!userData) return out

  const em = userData.email ? hashEmail(userData.email) : null
  if (em) out.em = [em]

  const ph = userData.phone ? hashPhone(userData.phone) : null
  if (ph) out.ph = [ph]

  const ext = userData.externalId ? hashExternalId(userData.externalId) : null
  if (ext) out.external_id = [ext]

  if (userData.fbp?.trim()) out.fbp = userData.fbp.trim()
  if (userData.fbc?.trim()) out.fbc = userData.fbc.trim()
  if (userData.clientIpAddress?.trim()) out.client_ip_address = userData.clientIpAddress.trim()
  if (userData.clientUserAgent?.trim()) out.client_user_agent = userData.clientUserAgent.trim()

  return out
}

function buildCustomDataPayload(customData: MetaCustomData | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (!customData) return out

  const value = typeof customData.value === "number" ? customData.value : Number(customData.value)
  if (Number.isFinite(value) && value > 0) {
    out.value = Math.round(value * 100) / 100
    out.currency = customData.currency?.trim().toUpperCase() || "USD"
  }

  const ids = (customData.contentIds ?? [])
    .map((id) => String(id ?? "").trim())
    .filter(Boolean)
  if (ids.length) {
    out.content_ids = ids
    out.content_type = customData.contentType?.trim() || "product"
  }

  if (customData.orderId?.trim()) out.order_id = customData.orderId.trim()
  if (typeof customData.numItems === "number" && customData.numItems > 0) {
    out.num_items = customData.numItems
  }

  return out
}

export type SendMetaServerEventResult = {
  ok: boolean
  status: number
  skipped: boolean
  skipReason?: string
  detail?: string
}

let metaCapiMissingConfigWarned = false

/**
 * Fire a single server event to the Meta Conversions API. Never throws — failures are logged
 * and returned so callers can safely `void` this from request paths (e.g. checkout).
 */
export async function sendMetaServerEvent(
  event: MetaServerEvent,
): Promise<SendMetaServerEventResult> {
  const pixelId = getMetaPixelId()
  const accessToken = getAccessToken()

  if (!pixelId || !accessToken) {
    if (!metaCapiMissingConfigWarned && process.env.NODE_ENV !== "production") {
      metaCapiMissingConfigWarned = true
      console.warn(
        "[meta-capi] Skipped: set NEXT_PUBLIC_META_PIXEL_ID and META_CONVERSIONS_API_ACCESS_TOKEN to enable server-side events.",
      )
    }
    return { ok: false, status: 0, skipped: true, skipReason: "Pixel id or access token missing" }
  }

  if (!event.eventId?.trim()) {
    return { ok: false, status: 0, skipped: true, skipReason: "Missing event_id (required for dedup)" }
  }

  const userData = buildUserDataPayload(event.userData)
  // Meta requires at least one user_data identifier to attribute the event.
  if (Object.keys(userData).length === 0) {
    return { ok: false, status: 0, skipped: true, skipReason: "No user_data identifiers" }
  }

  const eventTime = event.eventTime ?? Math.floor(Date.now() / 1000)
  const dataEntry: Record<string, unknown> = {
    event_name: event.eventName,
    event_time: eventTime,
    event_id: event.eventId.trim(),
    action_source: event.actionSource ?? "website",
    user_data: userData,
    // Mirrors the originating event so Meta can reconcile/dedupe even if signals shift.
    original_event_data: { event_name: event.eventName, event_time: eventTime },
  }
  if (event.eventSourceUrl?.trim()) dataEntry.event_source_url = event.eventSourceUrl.trim()

  const customData = buildCustomDataPayload(event.customData)
  if (Object.keys(customData).length > 0) dataEntry.custom_data = customData

  const body: Record<string, unknown> = { data: [dataEntry] }
  const testEventCode = getTestEventCode()
  if (testEventCode) body.test_event_code = testEventCode

  const url = `https://graph.facebook.com/${getGraphApiVersion()}/${pixelId}/events?access_token=${encodeURIComponent(accessToken)}`

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })

    const text = await res.text().catch(() => "")
    const ok = res.status >= 200 && res.status < 300

    if (!ok) {
      console.error("[meta-capi] Event failed:", event.eventName, res.status, text.slice(0, 800))
    } else if (process.env.NODE_ENV === "development") {
      console.log(`[meta-capi] Event accepted (${res.status}) event="${event.eventName}"`)
    }

    return { ok, status: res.status, skipped: false, detail: text.slice(0, 500) }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[meta-capi] Event fetch error:", event.eventName, e)
    return { ok: false, status: 0, skipped: false, detail: msg }
  }
}
