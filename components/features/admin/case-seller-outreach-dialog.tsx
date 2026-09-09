"use client"

import { useEffect, useState, useTransition } from "react"
import { Loader2, ShieldCheck } from "lucide-react"
import { toast } from "sonner"
import { openSellerSupportOutreachAction } from "@/lib/actions/supportCaseSellerOutreach"
import type { SellerSupportOutreachResult } from "@/lib/services/supportCaseSellerOutreach"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"

interface CaseSellerOutreachDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sourceCaseId: string
  orderRef: string
  sellerName: string
  defaultMessage: string
  onSent: (result: SellerSupportOutreachResult) => void
}

export function CaseSellerOutreachDialog({
  open,
  onOpenChange,
  sourceCaseId,
  orderRef,
  sellerName,
  defaultMessage,
  onSent,
}: CaseSellerOutreachDialogProps) {
  const [message, setMessage] = useState(defaultMessage)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    setMessage(defaultMessage)
  }, [defaultMessage, sourceCaseId])

  function send() {
    startTransition(async () => {
      const result = await openSellerSupportOutreachAction({
        source_case_id: sourceCaseId,
        message,
      })
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      onSent(result)
      onOpenChange(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Contact {sellerName} as Reswell Support</DialogTitle>
          <p className="text-sm text-muted-foreground">
            This opens or reuses a seller-facing case for order {orderRef}. The seller sees
            “Reswell Support,” receives the support email, and can reply in Help Hub.
          </p>
        </DialogHeader>
        <div className="flex gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2.5 text-xs text-emerald-950 dark:text-emerald-100">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>
            Privacy-safe draft: it shares the operational issue and requested action, without
            copying the buyer’s message, schedule, location, signature, or contact details.
          </p>
        </div>
        <Textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          rows={10}
          maxLength={8000}
          className="resize-y text-sm"
          placeholder="Explain what Reswell needs from the seller…"
        />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={pending || message.trim().length < 10}
            onClick={send}
          >
            {pending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            Send as Reswell
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
