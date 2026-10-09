"use client"

import { useState, useTransition } from "react"
import { Loader2 } from "lucide-react"
import { requestShopifyPluginAccessAction } from "@/lib/actions/shopifyAccessRequest"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface ShopifyAccessRequestDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  shopLabel: string | null
  alreadyRequested: boolean
}

export function ShopifyAccessRequestDialog({
  open,
  onOpenChange,
  shopLabel,
  alreadyRequested,
}: ShopifyAccessRequestDialogProps) {
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(alreadyRequested)
  const [pending, startTransition] = useTransition()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Request Shopify plugin access</DialogTitle>
          <DialogDescription>
            {shopLabel
              ? `${shopLabel} is ready to connect, but this Reswell account is not approved for the Shopify plugin yet.`
              : "This Reswell account is not approved for the Shopify plugin yet."}{" "}
            Request access and a Reswell admin will review it. Approval is not automatic.
          </DialogDescription>
        </DialogHeader>

        {sent ? (
          <p className="text-sm text-foreground">
            Your request is in. We’ll enable the plugin on this account if it’s approved.
            You can finish linking the store after that.
          </p>
        ) : null}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <DialogFooter>
          {sent ? (
            <Button type="button" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={pending}
              >
                Not now
              </Button>
              <Button
                type="button"
                disabled={pending}
                onClick={() => {
                  setError(null)
                  startTransition(async () => {
                    const result = await requestShopifyPluginAccessAction()
                    if ("error" in result) {
                      setError(result.error)
                      return
                    }
                    setSent(true)
                  })
                }}
              >
                {pending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                ) : null}
                Request access
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
