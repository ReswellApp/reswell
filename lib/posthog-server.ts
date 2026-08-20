import { PostHog } from 'posthog-node'

/**
 * Returns a short-lived PostHog Node client configured for per-request use.
 * Use `await client.flush()` before returning from any route/server-action handler
 * so the enqueued event sends before the serverless function is torn down.
 *
 * flushAt 1 / flushInterval 0 guarantees an immediate HTTP send on flush().
 */
export function getPostHogServerClient(): PostHog | null {
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST

  if (!token) {
    if (process.env.NODE_ENV !== 'production') {
      console.error(
        'NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or ' +
        'un-configured, this causes events to be silently missed. ' +
        'This error stops appearing once NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN is configured',
      )
    }
    return null
  }

  return new PostHog(token, {
    host,
    flushAt: 1,
    flushInterval: 0,
    enableExceptionAutocapture: true,
  })
}

export async function captureServerEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, string | number | boolean | string[] | undefined>,
): Promise<void> {
  const posthog = getPostHogServerClient()
  if (!posthog) return
  posthog.capture({ distinctId, event, properties })
  await posthog.shutdown()
}
