import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { ShopifyClaimPanel } from "@/components/features/integrations/shopify/shopify-claim-panel"
import { ShopifyClaimSignIn } from "@/components/features/integrations/shopify/shopify-claim-sign-in"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { getCachedDashboardSession } from "@/lib/dashboard-session"
import { SHOPIFY_CLAIM_COOKIE } from "@/lib/shopify/claim-cookie"
import { SHOPIFY_CONNECT_PATH } from "@/lib/shopify/claim-path"
import {
  isShopifyPublicOAuthConfigured,
  isShopifyPublicOAuthEnabled,
} from "@/lib/shopify/config"
import {
  decideShopifyConnectInstall,
  assessShopifyInstallLaunch,
} from "@/lib/shopify/install-launch"
import { getShopifyAccessRequestState } from "@/lib/services/shopifyAccessRequest"
import { previewShopifyPendingClaim } from "@/lib/services/shopifyClaim"
import { startPublicShopifyInstall } from "@/lib/services/shopifyPublicInstall"
import { privatePageMetadata } from "@/lib/site-metadata"

export const dynamic = "force-dynamic"

export const metadata = privatePageMetadata({
  title: "Link Shopify — Reswell",
  description: "Connect your Shopify store to your Reswell seller account.",
  path: SHOPIFY_CONNECT_PATH,
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

function InstallProblem({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-3xl flex-col justify-center px-4 py-12">
      <Alert variant="destructive" className="mx-auto max-w-lg">
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription>{description}</AlertDescription>
      </Alert>
    </main>
  )
}

export default async function ShopifyConnectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = toSearchParams(await searchParams)
  const launch = assessShopifyInstallLaunch(params)

  if (launch.kind === "rejected") {
    return (
      <InstallProblem
        title="This Shopify install link is invalid"
        description="Reswell could not verify the request from Shopify, so the install did not start."
      />
    )
  }

  if (launch.kind === "verified") {
    const { user } = await getCachedDashboardSession()
    const access = user ? await getShopifyAccessRequestState(user.id) : null
    const decision = decideShopifyConnectInstall({
      launch,
      signedIn: Boolean(user),
      shopifyConnectEnabled: access?.shopifyConnectEnabled === true,
      publicInstallAvailable:
        isShopifyPublicOAuthEnabled() && isShopifyPublicOAuthConfigured(),
    })

    if (decision.action === "start_public_install") {
      let installUrl: string
      try {
        installUrl = await startPublicShopifyInstall(decision.shopDomain)
      } catch (error) {
        console.error("[shopify] connect install", error)
        return (
          <InstallProblem
            title="Shopify install could not start"
            description="Return to Shopify and open the Reswell app again. Your store was not linked."
          />
        )
      }
      redirect(installUrl)
    }

    if (decision.action === "sign_in") {
      return (
        <ShopifyClaimSignIn
          preview={null}
          redirectTo={decision.returnPath}
          shopLabel={decision.shopDomain}
        />
      )
    }

    if (decision.action === "request_access" && user) {
      return (
        <main className="mx-auto flex min-h-[60vh] max-w-3xl flex-col justify-center px-4 py-12">
          <ShopifyClaimPanel
            preview={null}
            userEmail={user.email ?? null}
            shopifyConnectEnabled={false}
            accessRequested={Boolean(access?.requestedAt)}
            callbackError={false}
            installLaunchShop={decision.shopDomain}
          />
        </main>
      )
    }

    return (
      <InstallProblem
        title="Shopify install is unavailable"
        description="Public Shopify install is not available right now. Your store was not linked."
      />
    )
  }

  const cookieStore = await cookies()
  const claimSecret = cookieStore.get(SHOPIFY_CLAIM_COOKIE)?.value
  const preview = await previewShopifyPendingClaim(claimSecret)
  const { user } = await getCachedDashboardSession()

  if (!user) {
    return (
      <ShopifyClaimSignIn
        preview={preview}
        redirectTo={
          params.size > 0
            ? `${SHOPIFY_CONNECT_PATH}?${params.toString()}`
            : SHOPIFY_CONNECT_PATH
        }
      />
    )
  }

  const access = await getShopifyAccessRequestState(user.id)

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-3xl flex-col justify-center px-4 py-12">
      <ShopifyClaimPanel
        preview={preview}
        userEmail={user.email ?? null}
        shopifyConnectEnabled={access.shopifyConnectEnabled}
        accessRequested={Boolean(access.requestedAt)}
        callbackError={params.get("error") === "connection_failed"}
      />
    </main>
  )
}
