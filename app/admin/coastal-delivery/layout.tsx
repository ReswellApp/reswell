import { notFound, redirect } from "next/navigation"

import { CoastalDeliverySubnav } from "@/components/features/admin/coastal-delivery/coastal-delivery-subnav"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export default async function CoastalDeliveryLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect("/auth/login?redirect=/admin/coastal-delivery")
  }

  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle()
  if (profile?.is_admin !== true) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Coastal delivery</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Admin draft of white-glove surfboard hand delivery from Capitola through Bodega Bay. Buyers
          cannot see this. There is no charge and checkout is unchanged.
        </p>
      </div>
      <CoastalDeliverySubnav />
      {children}
    </div>
  )
}
