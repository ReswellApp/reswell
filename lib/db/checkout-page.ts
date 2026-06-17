import type { SupabaseClient, User } from "@supabase/supabase-js"
import type { CheckoutSeller } from "@/components/checkout-types"
import { fetchProfileAddresses } from "@/lib/db/profile-addresses"
import type { ProfileAddressRow } from "@/lib/profile-address"
import { formatProfileLegalName } from "@/lib/utils/profile-personal-info"

const CHECKOUT_SELLER_SELECT = "display_name, avatar_url, seller_slug, shop_name, is_shop"

export type CheckoutBuyerContext = {
  addresses: ProfileAddressRow[]
  addressesError: string | null
  buyerEmail: string | null
  legalFullName: string
}

export async function fetchCheckoutSellerProfile(
  supabase: SupabaseClient,
  sellerId: string,
): Promise<CheckoutSeller | null> {
  const { data: sellerRow } = await supabase
    .from("profiles")
    .select(CHECKOUT_SELLER_SELECT)
    .eq("id", sellerId)
    .maybeSingle()

  if (!sellerRow) {
    return null
  }

  return {
    display_name: sellerRow.display_name,
    avatar_url: sellerRow.avatar_url,
    seller_slug: sellerRow.seller_slug,
    shop_name: sellerRow.shop_name,
    is_shop: sellerRow.is_shop,
  }
}

export async function fetchCheckoutBuyerContext(
  supabase: SupabaseClient,
  user: User,
): Promise<CheckoutBuyerContext> {
  const authEmail = user.email?.trim() || null

  const [addressesResult, profileResult] = await Promise.all([
    fetchProfileAddresses(supabase, user.id),
    supabase
      .from("profiles")
      .select("email, display_name, first_name, last_name")
      .eq("id", user.id)
      .maybeSingle(),
  ])

  const profileEmail =
    typeof profileResult.data?.email === "string" ? profileResult.data.email.trim() : ""

  const legalFullName = formatProfileLegalName(
    profileResult.data?.first_name,
    profileResult.data?.last_name,
    profileResult.data?.display_name,
  )

  return {
    addresses: addressesResult.addresses,
    addressesError: addressesResult.error ?? null,
    buyerEmail: authEmail || profileEmail || null,
    legalFullName,
  }
}

export async function fetchCheckoutSellerAndBuyerContext(
  supabase: SupabaseClient,
  sellerId: string,
  user: User,
): Promise<{ seller: CheckoutSeller | null; buyer: CheckoutBuyerContext }> {
  const [seller, buyer] = await Promise.all([
    fetchCheckoutSellerProfile(supabase, sellerId),
    fetchCheckoutBuyerContext(supabase, user),
  ])

  return { seller, buyer }
}
