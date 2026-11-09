import { privatePageMetadata } from "@/lib/site-metadata"
import { CatalogVolumeCalculatorAdminClient } from "@/components/features/admin/catalog-volume-calculator/catalog-volume-calculator-admin-client"

export const metadata = privatePageMetadata({
  title: "Catalog volume calculator — Reswell admin",
  description:
    "Prototype: estimate custom surfboard volume from nearby catalog stock variants and measure leave-one-out accuracy.",
  path: "/admin/volume-calculator",
})

export default function AdminVolumeCalculatorPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <CatalogVolumeCalculatorAdminClient />
    </div>
  )
}
