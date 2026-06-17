/**
 * Server-only: sets Klaviyo SMS consent (transactional and/or marketing) for a profile.
 *
 * @see https://developers.klaviyo.com/en/docs/collect_email_and_sms_consent_via_api
 */

import "@/lib/klaviyo/bootstrap-env"
import { KLAVIYO_API_REVISION } from "@/lib/klaviyo/send-event"

const SUBSCRIBE_JOBS_URL =
  "https://a.klaviyo.com/api/profile-subscription-bulk-create-jobs/"

export type SmsConsentStatus = "SUBSCRIBED" | "UNSUBSCRIBED"

export type SubscribeKlaviyoProfileSmsConsentResult = {
  ok: boolean
  status: number
  skipped: boolean
  skipReason?: string
  detail: string
}

/**
 * Optional `KLAVIYO_SMS_SUBSCRIBE_LIST_ID` — when set, subscribes via that list (marketing).
 */
export async function subscribeKlaviyoProfileSmsConsent(input: {
  phoneNumber: string
  email?: string | null
  transactional?: SmsConsentStatus
  marketing?: SmsConsentStatus
}): Promise<SubscribeKlaviyoProfileSmsConsentResult> {
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

  if (!input.transactional && !input.marketing) {
    return {
      ok: false,
      status: 0,
      skipped: true,
      skipReason: "No SMS consent channel specified",
      detail: "",
    }
  }

  const phoneNumber = input.phoneNumber.trim()
  if (!phoneNumber) {
    return {
      ok: false,
      status: 0,
      skipped: true,
      skipReason: "Missing phone number",
      detail: "",
    }
  }

  const listId = process.env.KLAVIYO_SMS_SUBSCRIBE_LIST_ID?.trim()
  const email = input.email?.trim()

  const smsSubscriptions: Record<string, { consent: SmsConsentStatus }> = {}
  if (input.transactional) {
    smsSubscriptions.transactional = { consent: input.transactional }
  }
  if (input.marketing) {
    smsSubscriptions.marketing = { consent: input.marketing }
  }

  const profileAttributes: Record<string, unknown> = {
    phone_number: phoneNumber,
    subscriptions: { sms: smsSubscriptions },
  }

  if (email) {
    profileAttributes.email = email
  }

  const job: Record<string, unknown> = {
    type: "profile-subscription-bulk-create-job",
    attributes: {
      profiles: {
        data: [
          {
            type: "profile",
            attributes: profileAttributes,
          },
        ],
      },
    },
  }

  if (listId && input.marketing) {
    job.relationships = {
      list: {
        data: {
          type: "list",
          id: listId,
        },
      },
    }
  }

  try {
    const res = await fetch(SUBSCRIBE_JOBS_URL, {
      method: "POST",
      headers: {
        Authorization: `Klaviyo-API-Key ${apiKey}`,
        revision: KLAVIYO_API_REVISION,
        Accept: "application/vnd.api+json",
        "Content-Type": "application/vnd.api+json",
      },
      body: JSON.stringify({ data: job }),
    })

    const text = await res.text().catch(() => "")
    const ok = res.status >= 200 && res.status < 300

    if (!ok) {
      console.error("[klaviyo] SMS consent failed:", res.status, text.slice(0, 800))
    }

    return {
      ok,
      status: res.status,
      skipped: false,
      detail: text.slice(0, 500),
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[klaviyo] SMS consent fetch error:", e)
    return {
      ok: false,
      status: 0,
      skipped: false,
      detail: msg,
    }
  }
}
