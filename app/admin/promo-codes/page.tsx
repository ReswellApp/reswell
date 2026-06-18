import { privatePageMetadata } from "@/lib/site-metadata"
import { AdminPromoCodesClient } from "@/components/features/admin/admin-promo-codes-client"

export const metadata = privatePageMetadata({
  title: "Promo codes — Admin — Reswell",
  description: "Track newsletter promo code issuance, checkout holds, and order redemptions.",
  path: "/admin/promo-codes",
})

export default function AdminPromoCodesPage() {
  return (
    <>
      <h1 className="sr-only">Promo codes</h1>
      <AdminPromoCodesClient />
    </>
  )
}
