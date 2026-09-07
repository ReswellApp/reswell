"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { respondToCounterOfferAction } from "@/lib/actions/offerCounterRespond"
import { cn } from "@/lib/utils"

/**
 * Inline Accept / Decline for an open seller counter (thread cards).
 * Same server action as the counteroffer dialog — no extra confirmation step.
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
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null)

  async function run(action: "accept" | "decline") {
    setBusy(action)
    try {
      const result = await respondToCounterOfferAction({ offerId, action })
      if ("error" in result && result.error) {
        toast.error(result.error)
        return
      }
      toast.success(action === "accept" ? "Counteroffer accepted" : "Counteroffer declined")
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
        className="h-10 rounded-xl text-[14px] font-semibold"
        disabled={busy !== null}
        onClick={() => void run("accept")}
      >
        {busy === "accept" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : "Accept"}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-10 rounded-xl border-destructive/40 text-[14px] font-semibold text-destructive hover:bg-destructive/10 hover:text-destructive"
        disabled={busy !== null}
        onClick={() => void run("decline")}
      >
        {busy === "decline" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : "Decline"}
      </Button>
    </div>
  )
}
