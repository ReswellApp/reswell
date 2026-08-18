import { privatePageMetadata } from "@/lib/site-metadata"
import { PriceGuideAdminEditor } from "@/components/features/admin/price-guide/price-guide-admin-editor"

export const metadata = privatePageMetadata({
  title: "Edit price guide — Admin — Reswell",
  description: "Edit editorial pricing, comps, and publish state for a Price Guide entry.",
  path: "/admin/price-guide",
})

export default async function AdminPriceGuideEditorPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <PriceGuideAdminEditor id={id} />
}
