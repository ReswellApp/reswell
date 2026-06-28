"use client"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { AlertCircle } from "lucide-react"
import { scrollSellSectionIntoView } from "@/lib/sell-flow/scroll-section-into-view"

export type SellPublishValidationBannerProps = {
  message: string
  firstIncompleteSectionId: string | null
  firstIncompleteSectionLabel: string | null
  onDismiss: () => void
  bannerId?: string
}

export function SellPublishValidationBanner({
  message,
  firstIncompleteSectionId,
  firstIncompleteSectionLabel,
  onDismiss,
  bannerId = "sell-publish-validation-banner",
}: SellPublishValidationBannerProps) {
  return (
    <Alert id={bannerId} variant="destructive" className="mb-6">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Before you publish</AlertTitle>
      <AlertDescription>
        <p className="mb-3">{message}</p>
        <div className="flex flex-wrap gap-2">
          {firstIncompleteSectionId ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => scrollSellSectionIntoView(firstIncompleteSectionId)}
            >
              Go to {firstIncompleteSectionLabel ?? "section"}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-destructive/40 bg-background text-destructive hover:bg-destructive/5 hover:text-destructive"
            onClick={onDismiss}
          >
            Dismiss
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  )
}
