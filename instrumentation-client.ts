import { initBotId } from 'botid/client/core'
import { BOTID_PROTECTED_ROUTES } from '@/lib/botid/protected-routes'
import { installAbortErrorSuppressor } from '@/lib/client/install-abort-error-suppressor'
import { installChunkLoadRecovery } from '@/lib/client/install-chunk-load-recovery'
import { installSafeTouchEventGuard } from '@/lib/client/install-safe-touch-event-guard'
import { installWebViewBridgeNoiseSuppressor } from '@/lib/client/install-webview-bridge-noise-suppressor'
import { deferUntilIdleOrInteraction } from '@/lib/analytics/defer-until-idle'

initBotId({
  protect: [...BOTID_PROTECTED_ROUTES],
})

// Runs before React hydration so dev overlay ignores benign navigation aborts
// and Android WebView Java-bridge teardown noise ("Java object is gone").
installAbortErrorSuppressor()
installWebViewBridgeNoiseSuppressor()
installSafeTouchEventGuard()

// Self-heal stale-chunk failures (common in long-lived in-app browser tabs after a deploy)
// at the window level, before the error-boundary bundle itself can fail to load and drop
// the user onto the in-app browser's native "This page couldn't load" screen.
installChunkLoadRecovery()

// PostHog is deferred until idle / first input so posthog-js stays off the first-paint path.
const posthogToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN

if (!posthogToken && process.env.NODE_ENV !== 'production') {
  console.error(
    'NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, ' +
    'this causes events to be silently missed. ' +
    'This error stops appearing once NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN is configured',
  )
}

if (posthogToken) {
  deferUntilIdleOrInteraction(() => {
    void import('@/lib/client/init-posthog-client').then((mod) => {
      void mod.ensurePostHogClient()
    })
  })
}
