import { SymbolView } from "expo-symbols"
import type { MobileDashboardPageId } from "@reswell/api-contract"

const ICONS = {
  overview: { ios: "square.grid.2x2.fill", android: "grid_view", web: "grid_view" },
  shipper: { ios: "box.truck", android: "local_shipping", web: "local_shipping" },
  profile: { ios: "person.crop.circle", android: "account_circle", web: "account_circle" },
  earnings: { ios: "chart.bar", android: "bar_chart", web: "bar_chart" },
  "balance-sheet": { ios: "list.bullet", android: "view_list", web: "view_list" },
  listings: { ios: "list.bullet.rectangle", android: "list_alt", web: "list_alt" },
  shopify: { ios: "cart", android: "shopping_cart", web: "shopping_cart" },
  offers: { ios: "checkmark", android: "check", web: "check" },
  messages: { ios: "bubble.left", android: "chat_bubble", web: "chat_bubble" },
  support: { ios: "info.circle", android: "info", web: "info" },
  purchases: { ios: "cart", android: "shopping_cart", web: "shopping_cart" },
  sales: { ios: "checkmark.seal.fill", android: "verified", web: "verified" },
  favorites: { ios: "heart", android: "favorite_border", web: "favorite_border" },
  following: { ios: "person", android: "person", web: "person" },
  "seller-profile": { ios: "checkmark.seal.fill", android: "verified", web: "verified" },
} as const satisfies Record<MobileDashboardPageId, { ios: string; android: string; web: string }>

export function DashboardMenuIcon({ id, color }: { id: MobileDashboardPageId; color: string }) {
  return <SymbolView name={ICONS[id]} size={22} tintColor={color} />
}
