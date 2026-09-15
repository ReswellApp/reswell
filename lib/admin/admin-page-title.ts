import { flattenAdminNavItems, type AdminNavGroupConfig } from '@/lib/admin-nav'

/**
 * Resolve the current admin page label from the sidebar nav.
 * Detail routes inherit the closest parent item (e.g. `/admin/orders/xyz` → Orders).
 */
export function getAdminPageTitle(pathname: string, groups: AdminNavGroupConfig[]): string {
  const norm = pathname.replace(/\/$/, '') || '/'
  let best: { href: string; label: string } | null = null

  for (const item of flattenAdminNavItems(groups)) {
    const hrefPath = (item.href.split('?')[0] || item.href).replace(/\/$/, '')
    if (norm === hrefPath || norm.startsWith(`${hrefPath}/`)) {
      if (!best || hrefPath.length > best.href.length) {
        best = { href: hrefPath, label: item.label }
      }
    }
  }

  return best?.label ?? 'Admin'
}
