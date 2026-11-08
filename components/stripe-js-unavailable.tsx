"use client"

import { Button } from "@/components/ui/button"

export function StripeJsUnavailable({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex min-h-[100px] flex-col items-start justify-center gap-3">
      <p className="text-sm text-destructive">
        Payment form failed to load. Check your connection, pause any ad blocker for
        this page, and try again.
      </p>
      <Button type="button" variant="outline" size="sm" onClick={onRetry}>
        Try again
      </Button>
    </div>
  )
}
