import { privatePageMetadata } from "@/lib/site-metadata"
import { AdminShopOrdersClient } from "./admin-shop-orders-client"

export const metadata = privatePageMetadata({
  title: "Shop orders — Admin — Reswell",
  description: "Fulfill Reswell shop orders with ShipEngine labels and notify buyers.",
  path: "/admin/shop/orders",
})

export default function AdminShopOrdersPage() {
  return <AdminShopOrdersClient />
}
