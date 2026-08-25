import { redirect } from "next/navigation"
import { privatePageMetadata } from "@/lib/site-metadata"

export const metadata = privatePageMetadata({
  title: "Brand catalog explorer — Admin — Reswell",
  description:
    "Brand, model, and variant catalog now lives on the used board market dashboard.",
  path: "/admin/catalog-overview",
})

export default function AdminCatalogOverviewPage() {
  redirect("/admin/used-board-market-dashboard?tab=catalog")
}
