/**
 * Admin sidebar: grouped nav + role-based href filtering.
 * Icon keys are resolved in the client sidebar (Lucide components are not serializable).
 */
export type AdminNavIconKey =
  | 'layoutDashboard'
  | 'waves'
  | 'activity'
  | 'lineChart'
  | 'package'
  | 'layers'
  | 'folderTree'
  | 'tag'
  | 'users'
  | 'wallet'
  | 'shoppingBag'
  | 'lifeBuoy'
  | 'messageSquare'
  | 'shield'
  | 'truck'
  | 'settings'
  | 'target'
  | 'contactRound'

export interface AdminNavItemConfig {
  href: string
  label: string
  icon: AdminNavIconKey
}

export interface AdminNavGroupConfig {
  id: string
  label: string
  items: AdminNavItemConfig[]
}

/** Hrefs hidden for is_employee-only users (not full admin). */
const EMPLOYEE_EXCLUDED_HREFS = new Set<string>([
  '/admin/users',
  '/admin/wallets',
  '/admin/settings',
  '/admin/shipping',
  '/admin/listings/brand-requests',
  '/admin/listings/board-catalog-data',
])

export const ADMIN_NAV_GROUPS: AdminNavGroupConfig[] = [
  {
    id: 'overview',
    label: 'Overview',
    items: [
      { href: '/admin', label: 'Overview', icon: 'layoutDashboard' },
      { href: '/admin/listings', label: 'Listings', icon: 'package' },
      { href: '/admin/users', label: 'Users', icon: 'users' },
      { href: '/admin/wallets', label: 'Wallet balances', icon: 'wallet' },
      { href: '/admin/settings', label: 'Settings', icon: 'settings' },
    ],
  },
  {
    id: 'analytics',
    label: 'Analytics',
    items: [
      { href: '/admin/live', label: 'Live', icon: 'activity' },
      { href: '/admin/used-board-market-dashboard', label: 'Used board market', icon: 'waves' },
      { href: '/admin/catalog-overview', label: 'Brand catalog explorer', icon: 'folderTree' },
      { href: '/admin/search-analytics', label: 'Search analytics', icon: 'lineChart' },
      { href: '/admin/reswell-goals', label: 'Reswell goals', icon: 'target' },
      { href: '/admin/listings/board-catalog-data', label: 'User Listings Board Data', icon: 'layers' },
    ],
  },
  {
    id: 'customer-service',
    label: 'Customer service',
    items: [
      { href: '/admin/crm', label: 'CRM', icon: 'contactRound' },
      { href: '/admin/contact-messages', label: 'Support inbox', icon: 'messageSquare' },
      { href: '/admin/messages', label: 'Marketplace messages', icon: 'messageSquare' },
      {
        href: '/admin/fraud-messages',
        label: 'Fraud messages',
        icon: 'shield',
      },
      { href: '/admin/listings/brand-requests', label: 'Brand & model requests', icon: 'tag' },
    ],
  },
  {
    id: 'orders-shipping',
    label: 'Orders and shipping',
    items: [
      { href: '/admin/orders', label: 'Orders', icon: 'shoppingBag' },
      { href: '/admin/shipping', label: 'Shipping', icon: 'truck' },
    ],
  },
]

export function getAdminNavGroupsForUser(isAdmin: boolean): AdminNavGroupConfig[] {
  const allow = (href: string) => isAdmin || !EMPLOYEE_EXCLUDED_HREFS.has(href)

  return ADMIN_NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => allow(item.href)),
  })).filter((group) => group.items.length > 0)
}
