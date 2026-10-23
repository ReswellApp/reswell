"use server"

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import { resolveManagedSeller } from "@/lib/account-access/managed-seller"
import { createClient } from "@/lib/supabase/server"
import { checkShopifyMerchantAccess } from "@/lib/services/shopifyAccess"
import { claimShopifyPendingInstallation } from "@/lib/services/shopifyClaim"
import { SHOPIFY_CLAIM_COOKIE } from "@/lib/shopify/claim-cookie"
import { publicShopifyClaimError } from "@/lib/shopify/claim-errors"

export async function claimShopifyInstallAction(): Promise<
  { success: true } | { error: string }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: "Sign in to link this Shopify store to Reswell." }
  }

  const managed = await resolveManagedSeller("profile.manage")
  if (!managed.ok) return { error: managed.error }

  const cookieStore = await cookies()
  const claimSecret = cookieStore.get(SHOPIFY_CLAIM_COOKIE)?.value?.trim()
  if (!claimSecret) {
    return { error: "This Shopify install session has expired. Install again from Shopify." }
  }

  // A signed install proves store ownership; the claim approves the account.
  const access = await checkShopifyMerchantAccess(supabase, managed.seller.sellerId)
  if (!access.allowed && access.reason !== "not_approved") {
    return { error: access.message }
  }

  try {
    await claimShopifyPendingInstallation({
      userId: managed.seller.sellerId,
      claimSecret,
    })
    cookieStore.set(SHOPIFY_CLAIM_COOKIE, "", {
      path: "/",
      maxAge: 0,
      sameSite: "lax",
    })
    revalidatePath("/dashboard/shopify")
    revalidatePath("/shopify/claim")
    revalidatePath("/shopify/connect")
    return { success: true }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not link Shopify store"
    console.error("[shopify] claim", error)
    return { error: publicShopifyClaimError(error) }
  }
}
