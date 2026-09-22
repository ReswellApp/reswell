/**
 * Client-side ChatGPT Ads Measurement Pixel helpers.
 * No-ops until the base snippet in {@link file://../../components/openai-ads-pixel.tsx} has loaded.
 */

declare global {
  interface Window {
    oaiq?: (...args: unknown[]) => void
  }
}

/** SPA page view. The base snippet already measures the first full document load. */
export function sendOpenAiAdsPageViewed(): void {
  if (typeof window === "undefined" || typeof window.oaiq !== "function") return
  window.oaiq("measure", "page_viewed", {
    type: "contents",
    contents: [{ id: "page", name: document.title || "Reswell", content_type: "page" }],
  })
}
