"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Star, Loader2, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { sendSellerReviewRequest } from "@/app/actions/messages"
import { ratingStarFilledClassName } from "@/lib/rating-star-styles"
import { cn } from "@/lib/utils"
import { runServerAction } from "@/lib/utils/run-server-action"

type AskBuyerReviewButtonProps = {
  orderId: string
  /** From sale detail — links to the thread after send. */
  conversationId: string | null
  /** Server truth: request was already in messages (e.g. return visit). */
  initialAlreadySent?: boolean
}

function AmberStarsRow({ showPop }: { showPop: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center justify-center gap-0.5",
        showPop && "motion-safe:animate-review-stars-pop",
      )}
      aria-hidden
    >
      {[0, 1, 2, 3, 4].map((i) => (
        <Star
          key={i}
          className={cn(
            "h-[18px] w-[18px] transition-all duration-500 ease-out",
            ratingStarFilledClassName,
          )}
          strokeWidth={0}
          style={{ transitionDelay: `${i * 55}ms` }}
        />
      ))}
    </div>
  )
}

export function AskBuyerReviewButton({
  orderId,
  conversationId,
  initialAlreadySent = false,
}: AskBuyerReviewButtonProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [sent, setSent] = useState(initialAlreadySent)
  const [threadId, setThreadId] = useState<string | null>(conversationId)

  useEffect(() => {
    setSent(initialAlreadySent)
  }, [initialAlreadySent, orderId])

  useEffect(() => {
    setThreadId(conversationId)
  }, [conversationId])

  const onSend = useCallback(() => {
    startTransition(async () => {
      try {
        const result = await runServerAction(() =>
          sendSellerReviewRequest({ order_id: orderId }),
        )
        if ("error" in result) {
          toast.error(result.error)
          return
        }
        setThreadId(result.conversation_id)
        setSent(true)
        toast.success("Done. Your buyer will see this in Messages.", {
          description: "We’ve dropped a review card in your thread with them.",
          duration: 4500,
        })
        router.refresh()
      } catch {
        toast.error("Could not send review request")
      }
    })
  }, [orderId, router])

  if (sent) {
    return (
      <div className="space-y-2.5">
        <div
          className={cn(
            "rounded-xl border border-amber-500/35 bg-gradient-to-b from-amber-500/15 to-amber-500/[0.06]",
            "px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]",
          )}
        >
          <div className="flex items-start gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500/20">
              <CheckCircle2 className="h-5 w-5 text-amber-700 dark:text-amber-400" aria-hidden />
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <div>
                <p className="text-sm font-semibold text-foreground">Message sent to buyer</p>
                <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                  They’ll get your review request in this sale’s message thread. It is the same as any other chat from you.
                </p>
              </div>
              <AmberStarsRow showPop />
            </div>
          </div>
        </div>
        {threadId ? (
          <Button variant="outline" size="sm" className="w-full" asChild>
            <Link href={`/messages/${threadId}`}>Open message thread</Link>
          </Button>
        ) : null}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full gap-2 border-amber-500/25 hover:border-amber-500/45 hover:bg-amber-500/5"
        disabled={pending}
        onClick={() => onSend()}
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin text-amber-600 dark:text-amber-400" aria-hidden />
        ) : (
          <Star
            className={cn("h-4 w-4", ratingStarFilledClassName)}
            strokeWidth={0}
            aria-hidden
          />
        )}
        Ask for a review
      </Button>
      <p className="text-[11px] text-center text-muted-foreground">
        Sends a friendly message they can tap to leave stars.
      </p>
    </div>
  )
}
