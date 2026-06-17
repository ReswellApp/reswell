/**
 * Server-only: Klaviyo SMS **marketing** consent (e.g. optional message alerts toggle).
 */

import {
  subscribeKlaviyoProfileSmsConsent,
  type SubscribeKlaviyoProfileSmsConsentResult,
} from "@/lib/klaviyo/subscribe-profile-sms-consent"

export type SubscribeKlaviyoSmsMarketingResult = SubscribeKlaviyoProfileSmsConsentResult

export async function subscribeKlaviyoProfileSmsMarketing(input: {
  phoneNumber: string
  email?: string | null
  consent: "SUBSCRIBED" | "UNSUBSCRIBED"
}): Promise<SubscribeKlaviyoSmsMarketingResult> {
  return subscribeKlaviyoProfileSmsConsent({
    phoneNumber: input.phoneNumber,
    email: input.email,
    marketing: input.consent,
  })
}
