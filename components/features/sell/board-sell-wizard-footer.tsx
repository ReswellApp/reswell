"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SELL_PRIMARY_BUTTON_CLASS } from "@/components/features/sell/sell-form-surface"
import { cn } from "@/lib/utils"

type BoardSellWizardFooterProps = {
  showBack: boolean
  showNext: boolean
  nextLabel?: string
  backLabel?: string
  onBack: () => void
  onNext: () => void
  disabled?: boolean
}

export function BoardSellWizardFooter({
  showBack,
  showNext,
  nextLabel = "Next",
  backLabel = "Back",
  onBack,
  onNext,
  disabled = false,
}: BoardSellWizardFooterProps) {
  if (!showBack && !showNext) return null

  return (
    <div className="flex items-center justify-between gap-3 border-t border-border pt-6">
      {showBack ? (
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="gap-1.5"
          onClick={onBack}
          disabled={disabled}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          {backLabel}
        </Button>
      ) : (
        <span />
      )}
      {showNext ? (
        <Button
          type="button"
          size="lg"
          className={cn("gap-1.5", SELL_PRIMARY_BUTTON_CLASS)}
          onClick={onNext}
          disabled={disabled}
        >
          {nextLabel}
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Button>
      ) : null}
    </div>
  )
}
