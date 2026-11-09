"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { respondToCounterOfferAction } from "@/lib/actions/offerCounterRespond"
import { acceptedOfferCheckoutHref } from "@/lib/listing-href"
import { cn } from "@/lib/utils"

/**
 * Inline Accept / Decline for an open seller counter (thread cards).
 * Same server action as the counteroffer dialog — no extra confirmation step.
 * Accept sends the buyer straight to checkout at the agreed price.
 */
export function BuyerCounterRespondButtons({
  offerId,
  onCompleted,
  className,
}: {
  offerId: string
  onCompleted: () => void | Promise<void>
  className?: string
}) {
  const router = useRouter()
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null)

  async function run(action: "accept" | "decline") {
    setBusy(action)
    try {
      const result = await respondToCounterOfferAction({ offerId, action })
      if ("error" in result && result.error) {
        toast.error(result.error)
        return
      }
      if (action === "accept") {
        const checkoutHref =
          "checkoutHref" in result && typeof result.checkoutHref === "string"
            ? result.checkoutHref
            : acceptedOfferCheckoutHref(offerId)
        toast.success("Offer accepted — continue to checkout")
        // Navigate immediately so a slow thread refresh cannot leave Accept spinning.
        router.push(checkoutHref)
        void onCompleted()
        return
      }
      toast.success("Offer declined")
      await onCompleted()
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className={cn("grid grid-cols-2 gap-2", className)}>
      <Button
        type="button"
        size="sm"
        className="h-9 rounded-lg text-[13px] font-medium"
        disabled={busy !== null}
        onClick={() => void run("accept")}
      >
        {busy === "accept" ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          "Accept & checkout"
        )}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9 rounded-lg border-destructive/40 text-[13px] font-medium text-destructive hover:bg-destructive/10 hover:text-destructive"
        disabled={busy !== null}
        onClick={() => void run("decline")}
      >
        {busy === "decline" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : "Decline"}
      </Button>
    </div>
  )
}
