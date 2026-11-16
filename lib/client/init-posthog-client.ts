import { isPostHogBenignClientFetchError } from "@/lib/utils/is-abort-error"
import { isPostHogAndroidWebViewBridgeNoise } from "@/lib/utils/is-android-webview-bridge-noise"
import { isPostHogChunkLoadError } from "@/lib/utils/is-chunk-load-error"
import { isPostHogStaleFileNotFoundError } from "@/lib/utils/is-stale-file-not-found-error"
import { isPostHogStripeJsCdnLoadError } from "@/lib/utils/is-stripe-js-cdn-error"

type PostHogClient = (typeof import("posthog-js"))["default"]

let posthogClientPromise: Promise<PostHogClient | null> | null = null
let posthogInitialized = false

/**
 * Loads posthog-js and initializes the singleton once. Safe to call from
 * deferred instrumentation and from later identify / capture sites.
 */
export function ensurePostHogClient(): Promise<PostHogClient | null> {
  if (posthogClientPromise) return posthogClientPromise

  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN
  if (!token) {
    posthogClientPromise = Promise.resolve(null)
    return posthogClientPromise
  }

  const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST
  const uiHost = (posthogHost ?? "https://us.posthog.com")
    .replace("us.i.posthog.com", "us.posthog.com")
    .replace("eu.i.posthog.com", "eu.posthog.com")

  posthogClientPromise = import("posthog-js").then(({ default: posthog }) => {
    if (!posthogInitialized) {
      posthogInitialized = true
      posthog.init(token, {
        // Direct to PostHog. Proxying through /ingest billed every event as a
        // Vercel request plus Fast Origin Transfer. The /ingest rewrite stays
        // for clients that still have the old bundle cached.
        api_host: posthogHost && posthogHost.startsWith("http")
          ? posthogHost
          : "https://us.i.posthog.com",
        ui_host: uiHost,
        defaults: "2026-01-30",
        capture_exceptions: true,
        debug: process.env.NODE_ENV === "development",
        before_send: (event) => {
          if (isPostHogAndroidWebViewBridgeNoise(event)) return null
          if (isPostHogBenignClientFetchError(event)) return null
          if (isPostHogStaleFileNotFoundError(event)) return null
          if (isPostHogChunkLoadError(event)) return null
          if (isPostHogStripeJsCdnLoadError(event)) return null
          return event
        },
      })
    }
    return posthog
  })

  return posthogClientPromise
}
