import { redirect } from "next/navigation"
import { SHOPIFY_CONNECT_PATH } from "@/lib/shopify/claim-path"

export default async function LegacyShopifyClaimPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams
  if (params.error) {
    redirect(
      `${SHOPIFY_CONNECT_PATH}?error=${encodeURIComponent(params.error)}`,
    )
  }
  redirect(SHOPIFY_CONNECT_PATH)
}
