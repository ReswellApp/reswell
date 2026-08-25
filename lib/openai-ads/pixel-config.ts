/**
 * Shared ChatGPT Ads (OpenAI) Measurement Pixel configuration. Single source of truth
 * for resolving the pixel ID so the base snippet and every event sender agree.
 *
 * @see https://developers.openai.com/ads/measurement-pixel
 */

const PIXEL_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/

/** Returns the configured pixel ID, or null when unset/invalid (events should no-op). */
export function getOpenAiAdsPixelId(): string | null {
  const raw = process.env.NEXT_PUBLIC_OPENAI_ADS_PIXEL_ID?.trim()
  if (!raw || !PIXEL_ID_PATTERN.test(raw)) return null
  return raw
}

/**
 * `debug: true` logs SDK activity to the browser console. On in local/dev by default;
 * set NEXT_PUBLIC_OPENAI_ADS_PIXEL_DEBUG=true on a deploy while verifying the event stream.
 */
export function isOpenAiAdsPixelDebugEnabled(): boolean {
  const raw = process.env.NEXT_PUBLIC_OPENAI_ADS_PIXEL_DEBUG?.trim().toLowerCase()
  if (raw === "true" || raw === "1") return true
  if (raw === "false" || raw === "0") return false
  return process.env.NODE_ENV !== "production"
}
