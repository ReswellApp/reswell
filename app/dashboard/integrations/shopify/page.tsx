import { Suspense } from "react"
import { redirect } from "next/navigation"
import { getCachedDashboardSession } from "@/lib/dashboard-session"
import { ShopifyIntegrationClient } from "@/components/features/integrations/shopify-integration-client"
import { Loader2 } from "lucide-react"

function ShopifyIntegrationFallback() {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      Loading…
    </div>
  )
}

export default async function ShopifyIntegrationPage() {
  const { user } = await getCachedDashboardSession()
  if (!user) {
    redirect("/auth/login?redirect=/dashboard/integrations/shopify")
  }

  return (
    <Suspense fallback={<ShopifyIntegrationFallback />}>
      <ShopifyIntegrationClient />
    </Suspense>
  )
}
