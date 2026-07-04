/** Same-origin path only — avoids open redirects on ?next= / ?redirect= */
export function safeRedirectPath(path: string | null): string {
  if (!path || typeof path !== 'string') return '/'
  const p = path.trim()
  if (!p.startsWith('/') || p.startsWith('//')) return '/'
  return p
}

/** Same-origin path plus optional query string (pathname is validated). */
export function safeRedirectPathWithQuery(path: string | null): string {
  if (!path || typeof path !== 'string') return '/'
  const trimmed = path.trim()
  const qIndex = trimmed.indexOf('?')
  const pathname = qIndex === -1 ? trimmed : trimmed.slice(0, qIndex)
  const query = qIndex === -1 ? '' : trimmed.slice(qIndex)
  return `${safeRedirectPath(pathname)}${query}`
}
