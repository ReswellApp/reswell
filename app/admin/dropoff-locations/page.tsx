import { redirect } from "next/navigation"

import { DropoffLocationsAdminClient } from "@/components/features/admin/dropoff-locations-admin-client"
import { getDropoffLocationsAdminDashboard } from "@/lib/services/dropoffLocations"
import { privatePageMetadata } from "@/lib/site-metadata"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export const metadata = privatePageMetadata({
  title: "Dropoff locations — Admin — Reswell",
  description: "Set pack-and-ship dropoff box sizes and review listings that will be dropped off.",
  path: "/admin/dropoff-locations",
})

export default async function AdminDropoffLocationsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect("/auth/login?redirect=/admin/dropoff-locations")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle()

  if (!profile?.is_admin) {
    redirect("/")
  }

  const loaded = await getDropoffLocationsAdminDashboard()
  if (!loaded.ok) {
    redirect("/")
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Dropoff locations</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sellers on /sell/boards can drop a sold board here instead of packing it themselves. Box
          size is assigned from these rules — review listings and override a carton when needed.
        </p>
      </div>
      <DropoffLocationsAdminClient initialData={loaded.data} />
    </div>
  )
}
