import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { privatePageMetadata } from "@/lib/site-metadata"
import { createClient } from "@/lib/supabase/server"
import { fetchBuyerOrderSuccessPayload } from "@/lib/order-success-payload"
import { CheckoutOrderSuccess } from "@/components/checkout-order-success"

type PageProps = { params: Promise<{ id: string }> }

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { id } = await props.params
  return privatePageMetadata({
    title: "Order confirmation — Reswell",
    description:
      "Receipt, pickup or shipping details, and messaging for your completed Reswell purchase.",
    path: `/successpage/${id}`,
  })
}

/**
 * Post-purchase confirmation: loads the order by Supabase `orders.id` for the signed-in buyer.
 */
export default async function PurchaseSuccessPage(props: PageProps) {
  const { id } = await props.params
  if (!id?.trim()) {
    notFound()
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/auth/login?redirect=${encodeURIComponent(`/successpage/${id.trim()}`)}`)
  }

  const payload = await fetchBuyerOrderSuccessPayload(supabase, user.id, user.email, id)
  if (!payload) {
    notFound()
  }

  return <CheckoutOrderSuccess data={payload} />
}
