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
  | 'activityPulse'
  | 'sparkles'
  | 'fileText'
  | 'brain'
  | 'megaphone'
  | 'mapPin'
  | 'ticket'
  | 'bookOpen'
  | 'handshake'

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
  '/admin/seo',
  '/admin/google-merchant',
  '/admin/google-analytics',
  '/admin/ad-sales',
  '/admin/search-curation',
  '/admin/partner-embeds',
  '/admin/shipping',
  '/admin/tools',
  '/admin/site-assets',
  '/admin/pnl',
  '/admin/llm-usage',
  '/admin/intelligence',
  '/admin/listings/brand-requests',
  '/admin/listings/board-catalog-data',
  '/admin/fbcatalog',
  '/admin/facebook-marketplace-bulk',
  '/admin/listings/brand-model-autofills',
  '/admin/orders/test-purchase',
  '/admin/orders/terminal',
  '/admin/promo-codes',
  '/admin/listings/bulk',
  '/admin/shop',
  '/admin/shop/orders',
])

export const ADMIN_NAV_GROUPS: AdminNavGroupConfig[] = [
  {
    id: 'overview',
    label: 'Overview',
    items: [
      { href: '/admin/home', label: 'Home', icon: 'layoutDashboard' },
      { href: '/admin/overview', label: 'Overview', icon: 'activity' },
      { href: '/admin/listings', label: 'Listings', icon: 'package' },
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
    ],
  },
  {
    id: 'orders-shipping',
    label: 'Orders and shipping',
    items: [
      { href: '/admin/orders', label: 'Orders', icon: 'shoppingBag' },
      { href: '/admin/orders/terminal', label: 'In-person checkout', icon: 'shoppingBag' },
      { href: '/admin/shipping', label: 'Shipping', icon: 'truck' },
    ],
  },
  {
    id: 'tools',
    label: 'Tools',
    items: [
      { href: '/admin/llm-usage', label: 'LLM Usage', icon: 'sparkles' },
      { href: '/admin/search-quality', label: 'Search Quality', icon: 'sparkles' },
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
      { href: '/admin/google-merchant', label: 'Google Merchant', icon: 'shoppingCart' },
      { href: '/admin/google-analytics', label: 'Google Analytics', icon: 'lineChart' },
      { href: '/admin/ad-sales', label: 'Ad sales', icon: 'megaphone' },
      { href: '/admin/pickup-only-boards', label: 'Pickup-only boards', icon: 'mapPin' },
      { href: '/admin/used-board-market-dashboard?tab=catalog', label: 'Brand catalog explorer', icon: 'folderTree' },
      { href: '/admin/search-analytics', label: 'Search analytics', icon: 'lineChart' },
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
      { href: '/admin/fbcatalog', label: 'FB Marketplace catalog', icon: 'store' },
      { href: '/admin/facebook-marketplace-bulk', label: 'FB Marketplace export', icon: 'fileText' },
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
      { href: '/admin/orders/test-purchase', label: 'Test purchase', icon: 'shoppingBag' },
      { href: '/admin/fraud-messages', label: 'Fraud messages', icon: 'shield' },
      { href: '/admin/ops', label: 'Platform ops', icon: 'activityPulse' },
      { href: '/admin/partner-embeds', label: 'Partner embeds', icon: 'code' },
      { href: '/admin/pnl', label: 'P&L Tracker', icon: 'dollarSign' },
      { href: '/admin/reswelltickets', label: 'Reswell tickets', icon: 'ticket' },
      { href: '/admin/tools', label: 'Admin tools', icon: 'wrench' },
      { href: '/admin/site-assets', label: 'Site assets', icon: 'layers' },
      { href: '/admin/settings', label: 'Settings', icon: 'settings' },
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
