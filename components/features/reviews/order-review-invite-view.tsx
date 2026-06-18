"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Package, Star } from "lucide-react"
import { ReviewSellerControls, type ExistingSellerReview } from "@/components/review-seller-controls"
import { SellerReviewDialog } from "@/components/features/messages/seller-review-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ratingStarFilledClassName } from "@/lib/rating-star-styles"
import { cn } from "@/lib/utils"
import type { OrderReviewInvitePageContext } from "@/lib/services/orderReviewInvite"

type OrderReviewInviteViewProps = OrderReviewInvitePageContext

export function OrderReviewInviteView(props: OrderReviewInviteViewProps) {
  const router = useRouter()
  const [reviewOpen, setReviewOpen] = useState(false)

  const existingReview: ExistingSellerReview | null = props.existingReview

  useEffect(() => {
    if (props.canSubmitReview && !existingReview) {
      setReviewOpen(true)
    }
  }, [props.canSubmitReview, existingReview])

  return (
    <main className="flex-1 bg-background py-10 sm:py-14">
      <div className="container mx-auto max-w-xl px-4 sm:px-6 space-y-6">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Order {props.orderNum}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Review your purchase</h1>
          <p className="text-sm text-muted-foreground">{props.listingTitle}</p>
        </div>

        {existingReview ? (
          <ReviewSellerControls
            orderId={props.orderId}
            sellerName={props.sellerName}
            canReview={false}
            existingReview={existingReview}
          />
        ) : props.canSubmitReview ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">How was {props.sellerName}?</CardTitle>
              <CardDescription>
                Share a quick rating for this purchase. Your review helps other surfers buy with confidence.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button type="button" className="gap-2" onClick={() => setReviewOpen(true)}>
                <Star className={cn("h-4 w-4", ratingStarFilledClassName)} strokeWidth={0} />
                Write review
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-muted-foreground/20">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="h-5 w-5 text-muted-foreground" aria-hidden />
                Review opens after delivery
              </CardTitle>
              <CardDescription>
                {props.fulfillmentComplete
                  ? "This order is not eligible for a review right now."
                  : "You can leave a review once your order is delivered or local pickup is complete."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" asChild>
                <Link href={`/dashboard/purchases/${props.orderId}`}>View purchase details</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        <p className="text-center text-xs text-muted-foreground">
          <Link href={`/dashboard/purchases/${props.orderId}`} className="underline underline-offset-2">
            Open full purchase page
          </Link>
        </p>
      </div>

      {props.canSubmitReview && !existingReview ? (
        <SellerReviewDialog
          orderId={props.orderId}
          sellerName={props.sellerName}
          open={reviewOpen}
          onOpenChange={setReviewOpen}
          onSuccess={() => router.refresh()}
        />
      ) : null}
    </main>
  )
}
