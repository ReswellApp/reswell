import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { privatePageMetadata } from "@/lib/site-metadata"
import { AdminTestPurchaseClient } from "@/components/features/admin/admin-test-purchase-client"

export const metadata = privatePageMetadata({
  title: "Test purchase — Admin — Reswell",
  description: "Seed a confirmed marketplace order without Stripe for checkout and conversion QA.",
  path: "/admin/orders/test-purchase",
})

export default async function AdminTestPurchasePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login?redirect=/admin/orders/test-purchase")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle()

  if (!profile?.is_admin) {
    redirect("/")
  }

  return <AdminTestPurchaseClient />
}
