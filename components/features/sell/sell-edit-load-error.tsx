"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"

type SellEditLoadErrorProps = {
  message: string
  onRetry: () => void
  backHref?: string
  backLabel?: string
}

/** Compact failure state when edit listing hydration fails (timeout / network). */
export function SellEditLoadError({
  message,
  onRetry,
  backHref = "/sell",
  backLabel = "Back to sell",
}: SellEditLoadErrorProps) {
  return (
    <main className="flex flex-1 items-center justify-center bg-background py-24">
      <div
        className="mx-auto flex w-full max-w-md flex-col items-center gap-4 px-4 text-center"
        role="alert"
      >
        <p className="text-sm text-muted-foreground">{message}</p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button type="button" onClick={onRetry}>
            Retry
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href={backHref}>{backLabel}</Link>
          </Button>
        </div>
      </div>
    </main>
  )
}
