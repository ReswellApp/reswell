/**
 * Shared Meta (Facebook) Pixel configuration. Single source of truth for resolving the
 * pixel ID from the environment so the base snippet and every event sender agree.
 */

const META_PIXEL_ID_PATTERN = /^\d{10,20}$/

/** Returns the configured pixel ID, or null when unset/invalid (events should no-op). */
export function getMetaPixelId(): string | null {
  const raw = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim()
  if (!raw || !META_PIXEL_ID_PATTERN.test(raw)) return null
  return raw
}
