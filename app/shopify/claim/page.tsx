import { cookies } from "next/headers"
import { ShopifyClaimPanel } from "@/components/features/integrations/shopify/shopify-claim-panel"
import { getCachedDashboardSession } from "@/lib/dashboard-session"
import { SHOPIFY_CLAIM_COOKIE } from "@/lib/shopify/claim-cookie"
import { previewShopifyPendingClaim } from "@/lib/services/shopifyClaim"
import { privatePageMetadata } from "@/lib/site-metadata"

export const dynamic = "force-dynamic"

export const metadata = privatePageMetadata({
  title: "Link Shopify — Reswell",
  description: "Connect your Shopify store to your Reswell seller account.",
  path: "/shopify/claim",
})

export default async function ShopifyClaimPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const cookieStore = await cookies()
  const claimSecret = cookieStore.get(SHOPIFY_CLAIM_COOKIE)?.value
  const preview = await previewShopifyPendingClaim(claimSecret)
  const { user } = await getCachedDashboardSession()
  const params = await searchParams

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-3xl flex-col justify-center px-4 py-12">
      <ShopifyClaimPanel
        preview={preview}
        signedIn={Boolean(user)}
        userEmail={user?.email ?? null}
        callbackError={params.error === "connection_failed"}
      />
    </main>
  )
}
