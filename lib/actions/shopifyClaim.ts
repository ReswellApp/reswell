"use server"

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { checkShopifyMerchantAccess } from "@/lib/services/shopifyAccess"
import { claimShopifyPendingInstallation } from "@/lib/services/shopifyClaim"
import { SHOPIFY_CLAIM_COOKIE } from "@/lib/shopify/claim-cookie"
import { SHOPIFY_CLAIM_PATH, SHOPIFY_CONNECT_PATH } from "@/lib/shopify/claim-path"

function publicShopifyClaimError(error: unknown): string {
  const message = error instanceof Error ? error.message : ""
  if (/not approved/i.test(message)) {
    return "Your account is not approved for Shopify yet."
  }
  if (/already claimed/i.test(message)) {
    return "This Shopify install was already linked to a Reswell account."
  }
  if (/belongs to another/i.test(message) || /linked to another/i.test(message)) {
    return "This Shopify store cannot be linked to this Reswell account."
  }
  if (/not ready|expired|not found/i.test(message)) {
    return "This Shopify install session has expired. Install again from Shopify."
  }
  return "Could not link this Shopify store. Try installing again from Shopify."
}

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

  const cookieStore = await cookies()
  const claimSecret = cookieStore.get(SHOPIFY_CLAIM_COOKIE)?.value?.trim()
  if (!claimSecret) {
    return { error: "This Shopify install session has expired. Install again from Shopify." }
  }

  const access = await checkShopifyMerchantAccess(supabase, user.id)
  if (!access.allowed) {
    return { error: access.message }
  }

  try {
    await claimShopifyPendingInstallation({
      userId: user.id,
      claimSecret,
    })
    cookieStore.set(SHOPIFY_CLAIM_COOKIE, "", {
      path: "/",
      maxAge: 0,
      sameSite: "lax",
    })
    revalidatePath("/dashboard/shopify")
    revalidatePath(SHOPIFY_CONNECT_PATH)
    revalidatePath(SHOPIFY_CLAIM_PATH)
    return { success: true }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not link Shopify store"
    console.error("[shopify] claim", error)
    return { error: publicShopifyClaimError(error) }
  }
}
