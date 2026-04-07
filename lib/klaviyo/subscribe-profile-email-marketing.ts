/**
 * Server-only: sets Klaviyo **email marketing** consent to SUBSCRIBED for a profile.
 *
 * Uses Subscribe Profiles (async bulk job). Pair with account/list **single opt-in** if you
 * need immediate “subscribed” status (see Klaviyo API keys / list settings).
 *
 * @see https://developers.klaviyo.com/en/docs/collect_email_and_sms_consent_via_api
 * @see https://developers.klaviyo.com/en/reference/subscribe_profiles
 */

import "@/lib/klaviyo/bootstrap-env"
import { KLAVIYO_API_REVISION } from "@/lib/klaviyo/send-event"

const SUBSCRIBE_JOBS_URL =
  "https://a.klaviyo.com/api/profile-subscription-bulk-create-jobs/"

export type SubscribeKlaviyoEmailMarketingResult = {
  ok: boolean
  status: number
  skipped: boolean
  skipReason?: string
  detail: string
}

/**
 * Optional `KLAVIYO_EMAIL_SUBSCRIBE_LIST_ID` — when set, subscribes via that list (the list’s
 * single vs double opt-in rules apply). Omit to use account default API opt-in settings.
 */
export async function subscribeKlaviyoProfileEmailMarketing(input: {
  email: string
  externalId: string
}): Promise<SubscribeKlaviyoEmailMarketingResult> {
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

  const email = input.email.trim()
  const externalId = input.externalId.trim()
  if (!email || !externalId) {
    return {
      ok: false,
      status: 0,
      skipped: true,
      skipReason: "Missing email or external_id",
      detail: "",
    }
  }

  const listId = process.env.KLAVIYO_EMAIL_SUBSCRIBE_LIST_ID?.trim()

  const job: Record<string, unknown> = {
    type: "profile-subscription-bulk-create-job",
    attributes: {
      profiles: {
        data: [
          {
            type: "profile",
            attributes: {
              email,
              external_id: externalId,
              subscriptions: {
                email: {
                  marketing: {
                    consent: "SUBSCRIBED",
                  },
                },
              },
            },
          },
        ],
      },
    },
  }

  if (listId) {
    job.relationships = {
      list: {
        data: {
          type: "list",
          id: listId,
        },
      },
    }
  }

  const body = { data: job }

  try {
    const res = await fetch(SUBSCRIBE_JOBS_URL, {
      method: "POST",
      headers: {
        Authorization: `Klaviyo-API-Key ${apiKey}`,
        revision: KLAVIYO_API_REVISION,
        Accept: "application/vnd.api+json",
        "Content-Type": "application/vnd.api+json",
      },
      body: JSON.stringify(body),
    })

    const text = await res.text().catch(() => "")
    const ok = res.status >= 200 && res.status < 300

    if (!ok) {
      console.error(
        "[klaviyo] Email marketing subscribe failed:",
        res.status,
        text.slice(0, 800),
      )
    } else if (process.env.NODE_ENV === "development") {
      console.log(
        `[klaviyo] Email marketing subscribe accepted (${res.status}) for ${email}`,
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
    console.error("[klaviyo] Email marketing subscribe fetch error:", e)
    return {
      ok: false,
      status: 0,
      skipped: false,
      detail: msg,
    }
  }
}
