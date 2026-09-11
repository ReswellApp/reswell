import { sendFulfillmentReviewReminder } from "@/lib/services/orderReviewInvite"
import { autoSendSellerReviewRequestForOrder } from "@/lib/services/sellerReviewRequest"

/**
 * After pickup verified or shipping delivered:
 * 1. Klaviyo `Review Invite Sent` (fulfillment phase) — live flow "Post-purchase review"
 * 2. In-thread review card + Klaviyo `Review Requested` — live flow "Request review from buyer"
 */
export async function sendFulfillmentReviewPrompts(orderId: string): Promise<void> {
  await sendFulfillmentReviewReminder(orderId)

  try {
    const result = await autoSendSellerReviewRequestForOrder(orderId)
    if (!result.ok) {
      console.error("[fulfillmentReviewPrompts] review request:", result.error)
    }
  } catch (e) {
    console.error("[fulfillmentReviewPrompts] review request:", e)
  }
}
