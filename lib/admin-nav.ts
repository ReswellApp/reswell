/**
 * Admin sidebar: grouped nav + role-based href filtering.
 * Icon keys are resolved in the client sidebar (Lucide components are not serializable).
 */
import { EMPLOYEE_NAV_HREFS, EMPLOYEE_TOOLS } from '@/lib/admin/employee-access'

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
  | 'shoppingCart'
  | 'store'
  | 'lifeBuoy'
  | 'messageSquare'
  | 'shield'
  | 'truck'
  | 'settings'
  | 'target'
  | 'contactRound'
  | 'search'
  | 'wrench'
  | 'dollarSign'
  | 'bellRing'
  | 'code'
  | 'rotateCcw'
  | 'sparkles'
  | 'fileText'
  | 'brain'
  | 'megaphone'
  | 'mapPin'
  | 'ticket'
  | 'bookOpen'
  | 'handshake'
  | 'zap'
  | 'mail'

export interface AdminNavItemConfig {
  href: string
  label: string
  icon: AdminNavIconKey
  children?: AdminNavItemConfig[]
}

export interface AdminNavGroupConfig {
  id: string
  label: string
  items: AdminNavItemConfig[]
}

export const ADMIN_NAV_GROUPS: AdminNavGroupConfig[] = [
  {
    id: 'overview',
    label: 'Overview',
    items: [
      { href: '/admin/home', label: 'Home', icon: 'layoutDashboard' },
      { href: '/admin/listings', label: 'Listings', icon: 'package' },
      { href: '/admin/hayden-shop', label: "Hayden's Shop", icon: 'megaphone' },
      { href: '/admin/users', label: 'Users', icon: 'users' },
    ],
  },
  {
    id: 'reswell',
    label: 'Reswell',
    items: [
      { href: '/admin/shop', label: 'Reswell inventory', icon: 'store' },
      { href: '/admin/shop/orders', label: 'Shop orders', icon: 'shoppingBag' },
      { href: '/admin/we-buy', label: 'Buy program', icon: 'handshake' },
      { href: '/admin/careers', label: 'Career applications', icon: 'fileText' },
    ],
  },
  {
    id: 'orders-shipping',
    label: 'Orders and shipping',
    items: [
      { href: '/admin/orders', label: 'Orders', icon: 'shoppingBag' },
      { href: '/admin/orders/terminal', label: 'In-person checkout', icon: 'shoppingBag' },
      { href: '/admin/shipping', label: 'Shipping', icon: 'truck' },
      { href: '/admin/dropoff-locations', label: 'Dropoff locations', icon: 'mapPin' },
      { href: '/admin/shipper', label: 'Shipper', icon: 'truck' },
    ],
  },
  {
    id: 'tools',
    label: 'Tools',
    items: [
      { href: '/admin/email-studio', label: 'Email studio', icon: 'mail' },
      { href: '/admin/llm-usage', label: 'LLM Usage', icon: 'sparkles' },
      { href: '/admin/search-quality', label: 'Search Quality', icon: 'sparkles' },
      {
        href: '/admin/dimension-photo-match',
        label: 'Dimension photo match',
        icon: 'waves',
      },
      { href: '/admin/search-curation', label: 'Search Curation', icon: 'wrench' },
      { href: '/admin/price-guide', label: 'Price Guide', icon: 'bookOpen' },
      { href: '/admin/used-board-market-dashboard', label: 'Used Board Market Catalog', icon: 'waves' },
    ],
  },
  {
    id: 'analytics',
    label: 'Analytics',
    items: [
      { href: '/admin/intelligence', label: 'Intelligence', icon: 'brain' },
      { href: '/admin/cohorts', label: 'Cohorts', icon: 'users' },
      { href: '/admin/google-merchant', label: 'Google Merchant', icon: 'shoppingCart' },
      { href: '/admin/google-analytics', label: 'Google Analytics', icon: 'lineChart' },
      { href: '/admin/ad-sales', label: 'Ad sales', icon: 'megaphone' },
      { href: '/admin/ads', label: 'Ads manager', icon: 'megaphone' },
      { href: '/admin/pickup-only-boards', label: 'Pickup-only boards', icon: 'mapPin' },
      { href: '/admin/used-board-market-dashboard?tab=catalog', label: 'Brand catalog explorer', icon: 'folderTree' },
      { href: '/admin/search-analytics', label: 'Search analytics', icon: 'lineChart' },
      { href: '/admin/saved-searches', label: 'Saved searches', icon: 'bellRing' },
      { href: '/admin/search-daily-report', label: 'Search reports', icon: 'fileText' },
      { href: '/admin/listing-views', label: 'Listing views', icon: 'activity' },
      { href: '/admin/sell-funnel', label: 'Sell funnel', icon: 'lineChart' },
      { href: '/admin/browse-clicks', label: 'Browse clicks', icon: 'activity' },
      { href: '/admin/giveaways', label: 'Giveaways', icon: 'sparkles' },
      { href: '/admin/notifications', label: 'Notifications center', icon: 'bellRing' },
      { href: '/admin/promo-codes', label: 'Promo codes', icon: 'tag' },
      { href: '/admin/reswell-goals', label: 'Reswell goals', icon: 'target' },
      { href: '/admin/listings/brand-model-autofills', label: 'Brand/model autofills', icon: 'tag' },
      { href: '/admin/listings/board-catalog-data', label: 'User Listings Board Data', icon: 'layers' },
      { href: '/admin/boards-archive', label: 'Boards archive', icon: 'waves' },
      { href: '/admin/fbcatalog', label: 'FB Marketplace catalog', icon: 'store' },
      { href: '/admin/facebook-marketplace-bulk', label: 'FB Marketplace export', icon: 'fileText' },
    ],
  },
  {
    id: 'customer-service',
    label: 'Customer service',
    items: [
      { href: '/admin/crm', label: 'CRM', icon: 'contactRound' },
      {
        href: '/admin/contact-messages',
        label: 'Support tickets',
        icon: 'lifeBuoy',
        children: [
          { href: '/admin/support-macros', label: 'Reply macros', icon: 'zap' },
          { href: '/admin/support-reply-examples', label: 'Reply examples', icon: 'sparkles' },
          { href: '/admin/live-chat', label: 'Live chat', icon: 'messageSquare' },
        ],
      },
      { href: '/admin/messages', label: 'Marketplace messages', icon: 'messageSquare' },
      {
        href: '/admin/refund-thread-notifications',
        label: 'Refund notifications',
        icon: 'rotateCcw',
      },
      { href: '/admin/listings/brand-requests', label: 'Brand & model requests', icon: 'tag' },
    ],
  },
  {
    id: 'admin-tools',
    label: 'Admin tools',
    items: [
      { href: '/admin/listings/hidden', label: 'Hidden listings', icon: 'package' },
      { href: '/admin/listings/bulk', label: 'Bulk list', icon: 'layers' },
      { href: '/admin/seo', label: 'SEO', icon: 'search' },
      { href: '/admin/wallets', label: 'Wallet balances', icon: 'wallet' },
      { href: '/admin/sale-tips', label: 'Seller tips', icon: 'dollarSign' },
      { href: '/admin/fraud-messages', label: 'Fraud messages', icon: 'shield' },
      { href: '/admin/partner-embeds', label: 'Partner embeds', icon: 'code' },
      { href: '/admin/reswelltickets', label: 'Reswell tickets', icon: 'ticket' },
      { href: '/admin/tools', label: 'Admin tools', icon: 'wrench' },
      { href: '/admin/site-assets', label: 'Site assets', icon: 'layers' },
      { href: '/admin/settings', label: 'Settings', icon: 'settings' },
    ],
  },
]

export function adminNavItemHrefs(item: AdminNavItemConfig): string[] {
  return [item.href, ...(item.children ?? []).flatMap(adminNavItemHrefs)]
}

export function flattenAdminNavItems(groups: AdminNavGroupConfig[]): AdminNavItemConfig[] {
  return groups.flatMap((group) => group.items.flatMap((item) => [item, ...(item.children ?? [])]))
}

export function getAdminNavGroupsForUser(isAdmin: boolean): AdminNavGroupConfig[] {
  if (isAdmin) return ADMIN_NAV_GROUPS

  const byHref = new Map(
    flattenAdminNavItems(ADMIN_NAV_GROUPS).map((item) => [item.href, item]),
  )
  const items = EMPLOYEE_TOOLS.flatMap((tool) => {
    if (!EMPLOYEE_NAV_HREFS.has(tool.href)) return []
    const found = byHref.get(tool.href)
    if (!found) return []
    return [{ ...found, label: tool.label, children: undefined }]
  })

  return [{ id: 'employee', label: 'Employee', items }]
}
