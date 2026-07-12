import { redirect } from "next/navigation"
import { privatePageMetadata } from "@/lib/site-metadata"
import { createClient } from "@/lib/supabase/server"
import { FbCatalogAdminClient } from "@/components/features/admin/fbcatalog/fbcatalog-admin-client"

export const metadata = privatePageMetadata({
  title: "FB Marketplace catalog — Admin — Reswell",
  description:
    "Review manually imported Facebook Marketplace surfboard listings before promoting them into brand catalog variants.",
  path: "/admin/fbcatalog",
})

export default async function AdminFbCatalogPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect("/auth/login?redirect=/admin/fbcatalog")
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle()
  if (!profile?.is_admin) {
    redirect("/admin")
  }
  return <FbCatalogAdminClient />
}
