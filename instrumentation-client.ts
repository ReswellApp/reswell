import { installAbortErrorSuppressor } from '@/lib/client/install-abort-error-suppressor'
import { installChunkLoadRecovery } from '@/lib/client/install-chunk-load-recovery'
import { installSafeTouchEventGuard } from '@/lib/client/install-safe-touch-event-guard'
import { installWebViewBridgeNoiseSuppressor } from '@/lib/client/install-webview-bridge-noise-suppressor'
import { isPostHogBenignClientFetchError } from '@/lib/utils/is-abort-error'
import { isPostHogAndroidWebViewBridgeNoise } from '@/lib/utils/is-android-webview-bridge-noise'
import { isPostHogStaleFileNotFoundError } from '@/lib/utils/is-stale-file-not-found-error'
import posthog from 'posthog-js'

// Runs before React hydration so dev overlay ignores benign navigation aborts
// and Android WebView Java-bridge teardown noise ("Java object is gone").
installAbortErrorSuppressor()
installWebViewBridgeNoiseSuppressor()
installSafeTouchEventGuard()

// Self-heal stale-chunk failures (common in long-lived in-app browser tabs after a deploy)
// at the window level, before the error-boundary bundle itself can fail to load and drop
// the user onto the in-app browser's native "This page couldn't load" screen.
installChunkLoadRecovery()

// PostHog client-side analytics initialization.
const posthogToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN
const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST

if (!posthogToken && process.env.NODE_ENV !== 'production') {
  console.error(
    'NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, ' +
    'this causes events to be silently missed. ' +
    'This error stops appearing once NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN is configured',
  )
}

if (posthogToken) {
  const uiHost = (posthogHost ?? 'https://us.posthog.com')
    .replace('us.i.posthog.com', 'us.posthog.com')
    .replace('eu.i.posthog.com', 'eu.posthog.com')

  posthog.init(posthogToken, {
    api_host: '/ingest',
    ui_host: uiHost,
    defaults: '2026-01-30',
    capture_exceptions: true,
    debug: process.env.NODE_ENV === 'development',
    before_send: (event) => {
      if (isPostHogAndroidWebViewBridgeNoise(event)) return null
      if (isPostHogBenignClientFetchError(event)) return null
      if (isPostHogStaleFileNotFoundError(event)) return null
      return event
    },
  })
}
