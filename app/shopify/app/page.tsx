import { redirect } from "next/navigation"
import { ShopifyEmbeddedAppHome } from "@/components/features/integrations/shopify/shopify-embedded-app-home"
import { ShopifyConsentShell } from "@/components/features/integrations/shopify/shopify-consent-shell"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { dbListSelectedShopifyProductIds } from "@/lib/db/shopifyCatalog"
import { dbGetShopifyConnectionByDomain } from "@/lib/db/shopifyConnections"
import {
  isShopifyPublicOAuthConfigured,
  isShopifyPublicOAuthEnabled,
  shopifyApiKey,
} from "@/lib/shopify/config"
import { assessShopifyInstallLaunch } from "@/lib/shopify/install-launch"
import { privatePageMetadata } from "@/lib/site-metadata"
import { getShopifyEmbeddedHomeData } from "@/lib/services/shopifyEmbeddedHome"
import {
  isShopifyStoreLinkedForLaunch,
  startPublicShopifyInstall,
} from "@/lib/services/shopifyPublicInstall"

export const dynamic = "force-dynamic"

export const metadata = privatePageMetadata({
  title: "Reswell — Shopify",
  description: "Reswell sales channel for Shopify.",
  path: "/shopify/app",
})

function toSearchParams(
  raw: Record<string, string | string[] | undefined>,
): URLSearchParams {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") params.append(key, value)
    else if (Array.isArray(value)) {
      for (const item of value) params.append(key, item)
    }
  }
  return params
}

export default async function ShopifyEmbeddedAppPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = toSearchParams(await searchParams)
  const launch = assessShopifyInstallLaunch(params)
  const host =
    typeof params.get("host") === "string" ? params.get("host") : null

  if (launch.kind === "rejected") {
    return (
      <ShopifyConsentShell>
        <Alert variant="destructive" className="rounded-2xl bg-background p-6 shadow-sm">
          <AlertTitle>This Shopify app link is invalid</AlertTitle>
          <AlertDescription>
            Reswell could not verify the request from Shopify. Open the Reswell app
            again from Shopify admin.
          </AlertDescription>
        </Alert>
      </ShopifyConsentShell>
    )
  }

  if (launch.kind !== "verified") {
    return (
      <ShopifyConsentShell>
        <Alert className="rounded-2xl bg-background p-6 shadow-sm">
          <AlertTitle>Open Reswell from Shopify</AlertTitle>
          <AlertDescription>
            Launch the Reswell sales channel from your Shopify admin to manage
            publishing.
          </AlertDescription>
        </Alert>
      </ShopifyConsentShell>
    )
  }

  const shopDomain = launch.shopDomain
  let apiKey = ""
  try {
    apiKey = shopifyApiKey()
  } catch {
    apiKey = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY?.trim() || ""
  }

  if (await isShopifyStoreLinkedForLaunch(shopDomain, null)) {
    const home = await getShopifyEmbeddedHomeData(shopDomain)
    let publishedCount = 0
    if (home.connection) {
      try {
        const service = createServiceRoleClient()
        const connection = await dbGetShopifyConnectionByDomain(service, shopDomain)
        if (connection) {
          publishedCount = (
            await dbListSelectedShopifyProductIds(service, connection.id)
          ).length
        }
      } catch (error) {
        console.error("[shopify] embedded published count", error)
      }
    }
    return (
      <ShopifyEmbeddedAppHome
        apiKey={apiKey}
        shopDomain={shopDomain}
        host={host}
        linked={home.linked}
        connection={home.connection}
        publishedCount={publishedCount}
        installUrl={null}
      />
    )
  }

  if (isShopifyPublicOAuthEnabled() && isShopifyPublicOAuthConfigured()) {
    try {
      const installUrl = await startPublicShopifyInstall(shopDomain)
      // First-time installs still need the OAuth grant screen (top-level).
      if (!host) {
        redirect(installUrl)
      }
      return (
        <ShopifyEmbeddedAppHome
          apiKey={apiKey}
          shopDomain={shopDomain}
          host={host}
          linked={false}
          connection={null}
          publishedCount={0}
          installUrl={installUrl}
        />
      )
    } catch (error) {
      console.error("[shopify] embedded install", error)
    }
  }

  return (
    <ShopifyEmbeddedAppHome
      apiKey={apiKey}
      shopDomain={shopDomain}
      host={host}
      linked={false}
      connection={null}
      publishedCount={0}
      installUrl={null}
    />
  )
}
