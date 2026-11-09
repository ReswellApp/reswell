import { notFound, redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export default async function ShipperAdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect("/auth/login?redirect=/admin/shipper")
  }

  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle()
  if (profile?.is_admin !== true) {
    notFound()
  }

  return children
}
