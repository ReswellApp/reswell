"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { withdrawOfferAction } from "@/lib/actions/withdrawOffer"
import { cn } from "@/lib/utils"

export function OfferWithdrawButton({
  offerId,
  onCompleted,
  className,
  size = "sm",
}: {
  offerId: string
  onCompleted?: () => void | Promise<void>
  className?: string
  size?: "sm" | "default"
}) {
  const [busy, setBusy] = useState(false)

  return (
    <Button
      type="button"
      variant="outline"
      size={size}
      className={cn(className)}
      disabled={busy}
      onClick={() => {
        void (async () => {
          setBusy(true)
          try {
            const result = await withdrawOfferAction({ offerId })
            if ("error" in result && result.error) {
              toast.error(result.error)
              return
            }
            toast.success("Offer withdrawn. Your reserve is released.")
            await onCompleted?.()
          } finally {
            setBusy(false)
          }
        })()
      }}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : "Withdraw offer"}
    </Button>
  )
}
