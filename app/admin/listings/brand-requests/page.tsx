import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { BrandRequestsAdminClient } from "./brand-requests-client"

export default async function AdminBrandRequestsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect("/auth/login?redirect=/admin/listings/brand-requests")
  }
  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle()
  if (!profile?.is_admin) {
    redirect("/admin")
  }
  return <BrandRequestsAdminClient />
}
