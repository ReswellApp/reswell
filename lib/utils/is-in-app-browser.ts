/**
 * In-app browsers (the embedded webviews opened from Instagram, Facebook, TikTok,
 * Snapchat, Gmail, the Google app, LinkedIn, etc.) routinely fail third-party OAuth:
 * Google often blocks embedded webviews (`disallowed_useragent`), and even when it
 * doesn't, the multi-redirect return frequently dies as a native "This page couldn't
 * load" screen that no JS error boundary can catch.
 *
 * Use {@link isInAppBrowser} to hand off Google OAuth to the system browser before
 * starting PKCE (see {@link openInSystemBrowser} and {@link buildGoogleOAuthHandoffUrl}).
 */

/** Known in-app webview UA tokens (case-insensitive). */
const IN_APP_UA_TOKENS = [
  "fban", // Facebook app
  "fbav",
  "fb_iab",
  "fbios",
  "instagram",
  "line/",
  "micromessenger", // WeChat
  "musical_ly", // TikTok
  "bytedance",
  "tiktok",
  "snapchat",
  "linkedinapp",
  "pinterest",
  "twitter",
  "gsa/", // Google Search app in-app browser
  "okhttp",
] as const

/**
 * Best-effort detection of an embedded in-app browser from a user-agent string.
 *
 * Conservative on purpose: SFSafariViewController and Chrome Custom Tabs share the
 * system browser's cookies and complete OAuth fine, so they are intentionally treated
 * as NOT in-app. We flag known social/app webviews plus the reliable Android WebView
 * (`; wv`) marker.
 */
export function isInAppBrowser(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false
  const ua = userAgent.toLowerCase()

  if (IN_APP_UA_TOKENS.some((token) => ua.includes(token))) return true

  // Android System WebView always carries the "; wv" token (true embedded webview,
  // unlike Chrome Custom Tabs which presents as full Chrome).
  if (ua.includes("; wv")) return true

  return false
}

/** Client-only convenience: reads `navigator.userAgent`. Returns false on the server. */
export function isInAppBrowserClient(): boolean {
  if (typeof navigator === "undefined") return false
  return isInAppBrowser(navigator.userAgent)
}
