import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { loadOrderReviewInvitePageContext } from "@/lib/services/orderReviewInvite"
import { privatePageMetadata } from "@/lib/site-metadata"
import { createClient } from "@/lib/supabase/server"
import {
  decodeOrderReviewInviteToken,
  orderPurchaseReviewPath,
} from "@/lib/utils/order-review-invite-token"

type PageProps = { params: Promise<{ token: string }> }

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { token } = await props.params
  return privatePageMetadata({
    title: "Leave a review — Reswell",
    description: "Rate your seller for a completed Reswell purchase.",
    path: `/review/${token}`,
  })
}

/**
 * Legacy email deep link. Always send the buyer to the purchase page (Review seller)
 * instead of 404ing when the token is stale or belongs to another account.
 */
export default async function OrderReviewInvitePage(props: PageProps) {
  const { token } = await props.params
  const trimmed = decodeOrderReviewInviteToken(token ?? "")
  if (!trimmed) {
    redirect("/dashboard/purchases")
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const reviewPath = `/review/${encodeURIComponent(trimmed)}`
  if (!user) {
    redirect(`/auth/login?redirect=${encodeURIComponent(reviewPath)}`)
  }

  const context = await loadOrderReviewInvitePageContext(trimmed, user.id)
  if (context) {
    redirect(orderPurchaseReviewPath(context.orderId))
  }

  redirect("/dashboard/purchases")
}
