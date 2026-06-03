import { redirect } from "next/navigation"
import { privatePageMetadata } from "@/lib/site-metadata"
import { createClient } from "@/lib/supabase/server"
import { BrandModelAutofillsAdminClient } from "./brand-model-autofills-client"

export const metadata = privatePageMetadata({
  title: "Brand/model autofills — Admin — Reswell",
  description:
    "Cross-verify directory brands and catalog models the daily cron auto-attached to listings from their titles.",
  path: "/admin/listings/brand-model-autofills",
})

export default async function AdminBrandModelAutofillsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect("/auth/login?redirect=/admin/listings/brand-model-autofills")
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle()
  if (!profile?.is_admin) {
    redirect("/admin")
  }
  return <BrandModelAutofillsAdminClient />
}
