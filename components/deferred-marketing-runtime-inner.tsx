'use client'

import { Analytics } from '@vercel/analytics/next'

import { hasMarketingConsent } from '@/lib/analytics/marketing-consent'
import { KlaviyoOnsite } from '@/components/klaviyo-onsite'
import { MarketingPageViewTracker } from '@/components/marketing-page-view-tracker'
import { PostHogIdentify } from '@/components/posthog-identify'

/**
 * Heavy marketing/analytics runtime. Loaded only from {@link DeferredMarketingRuntime}
 * after idle or first interaction so it stays off the critical path.
 */
export function DeferredMarketingRuntimeInner() {
  const allowMarketing = hasMarketingConsent()

  return (
    <>
      {allowMarketing ? <KlaviyoOnsite /> : null}
      <MarketingPageViewTracker />
      <PostHogIdentify />
      <Analytics />
    </>
  )
}
