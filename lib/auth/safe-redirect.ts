/** Same-origin path only — avoids open redirects on ?next= / ?redirect= */
export function safeRedirectPath(path: string | null): string {
  if (!path || typeof path !== 'string') return '/'
  const p = path.trim()
  if (!p.startsWith('/') || p.startsWith('//')) return '/'
  return p
}
