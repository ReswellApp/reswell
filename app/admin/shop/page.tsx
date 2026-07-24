import { privatePageMetadata } from "@/lib/site-metadata"
import { AdminShopClient } from "@/components/features/admin/admin-shop-client"

export const metadata = privatePageMetadata({
  title: "Reswell — Admin — Reswell",
  description: "Create and manage Reswell-fulfilled inventory with stock quantities.",
  path: "/admin/shop",
})

export default function AdminShopPage() {
  return <AdminShopClient />
}
