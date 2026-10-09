"use server"

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { requestShopifyPluginAccess } from "@/lib/services/shopifyAccessRequest"
import { SHOPIFY_CLAIM_COOKIE } from "@/lib/shopify/claim-cookie"

export async function requestShopifyPluginAccessAction(): Promise<
  { success: true; alreadyRequested: boolean } | { error: string }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: "Sign in to request Shopify plugin access." }
  }

  const claimSecret = (await cookies()).get(SHOPIFY_CLAIM_COOKIE)?.value
  try {
    const result = await requestShopifyPluginAccess({
      userId: user.id,
      claimSecret,
    })
    revalidatePath("/shopify/claim")
    return result
  } catch (error) {
    console.error("[shopify] access request", error)
    return { error: "Could not send your Shopify access request." }
  }
}
