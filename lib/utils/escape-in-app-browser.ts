/**
 * Opens a URL in the device system browser from an embedded in-app webview.
 * Must be called from a user gesture (button click). Google OAuth cannot run
 * inside these webviews; the handoff URL should be a Reswell auth page that
 * starts OAuth after landing in Safari/Chrome.
 */

function isAndroidUa(ua: string): boolean {
  return /android/i.test(ua)
}

function isIosUa(ua: string): boolean {
  return /iphone|ipad|ipod/i.test(ua)
}

function isInstagramUa(ua: string): boolean {
  return ua.includes('instagram')
}

function isFacebookInAppUa(ua: string): boolean {
  return (
    ua.includes('fban') ||
    ua.includes('fbav') ||
    ua.includes('fb_iab') ||
    ua.includes('fbios')
  )
}

/**
 * Best-effort escape URL for the current in-app browser. Falls back to the
 * original HTTPS URL when no platform-specific scheme applies.
 */
export function buildInAppBrowserEscapeUrl(
  httpsUrl: string,
  userAgent?: string | null,
): string {
  const ua = (userAgent ?? '').toLowerCase()
  if (!ua) return httpsUrl

  if (isAndroidUa(ua)) {
    const path = httpsUrl.replace(/^https:\/\//, '')
    return `intent://${path}#Intent;scheme=https;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;S.browser_fallback_url=${encodeURIComponent(httpsUrl)};end`
  }

  if (isIosUa(ua)) {
    if (isInstagramUa(ua)) {
      return `instagram://extbrowser/?url=${encodeURIComponent(httpsUrl)}`
    }
    if (isFacebookInAppUa(ua)) {
      return `x-safari-${httpsUrl}`
    }
    return `x-safari-${httpsUrl}`
  }

  return httpsUrl
}

/** Navigate via a synthetic anchor so the host app treats it as a user-initiated open. */
export function openInSystemBrowser(httpsUrl: string): void {
  if (typeof document === 'undefined') return

  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  const href = buildInAppBrowserEscapeUrl(httpsUrl, ua)

  const anchor = document.createElement('a')
  anchor.href = href
  anchor.target = '_blank'
  anchor.rel = 'noopener noreferrer'
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)

  if (href === httpsUrl) {
    window.open(httpsUrl, '_blank', 'noopener,noreferrer')
  }
}
