'use client'

import { useEffect, useState, type ComponentType, type ReactNode } from 'react'

import { deferUntilIdleOrInteraction } from '@/lib/analytics/defer-until-idle'

/**
 * Keeps Klaviyo, PostHog identify, page-view beacons, and Vercel Analytics out of the
 * initial document. The inner chunk downloads only after idle or first interaction.
 */
export function DeferredMarketingRuntime(): ReactNode {
  const [Inner, setInner] = useState<ComponentType | null>(null)

  useEffect(() => {
    return deferUntilIdleOrInteraction(() => {
      void import('@/components/deferred-marketing-runtime-inner').then((mod) => {
        setInner(() => mod.DeferredMarketingRuntimeInner)
      })
    })
  }, [])

  if (!Inner) return null
  return <Inner />
}
