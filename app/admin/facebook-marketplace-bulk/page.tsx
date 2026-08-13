import { Suspense } from "react"
import { redirect } from "next/navigation"
import { Loader2 } from "lucide-react"
import { privatePageMetadata } from "@/lib/site-metadata"
import { createClient } from "@/lib/supabase/server"
import { FacebookMarketplaceBulkClient } from "@/components/features/admin/facebook-marketplace-bulk/facebook-marketplace-bulk-client"

export const metadata = privatePageMetadata({
  title: "FB Marketplace export — Admin — Reswell",
  description:
    "Choose a seller and export active listings into Facebook Marketplace’s bulk upload spreadsheet.",
  path: "/admin/facebook-marketplace-bulk",
})

function BulkExportFallback() {
  return (
    <div className="flex items-center justify-center py-24 text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
    </div>
  )
}

export default async function AdminFacebookMarketplaceBulkPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect("/auth/login?redirect=/admin/facebook-marketplace-bulk")
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle()
  if (!profile?.is_admin) {
    redirect("/admin")
  }
  return (
    <Suspense fallback={<BulkExportFallback />}>
      <FacebookMarketplaceBulkClient />
    </Suspense>
  )
}
