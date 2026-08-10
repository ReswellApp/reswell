"use client"

import Link from "next/link"
import { Check, ChevronDown, ChevronLeft, ChevronRight, Circle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SELL_PRIMARY_BUTTON_CLASS } from "@/components/features/sell/sell-form-surface"
import {
  boardSellViewModeLabel,
  type BoardSellPickerMode,
  type BoardSellViewMode,
} from "@/lib/sell-flow/board-sell-view-mode"
import { cn } from "@/lib/utils"

type BoardSellViewToolbarProps = {
  viewMode: BoardSellPickerMode
  onViewModeChange: (mode: BoardSellViewMode) => void
  /**
   * When set, shows Quick list in the view picker and runs this on select
   * (typically flush draft → navigate to `/sell/quick`). Omit while editing.
   */
  onSelectQuickList?: () => void
  /** When set, shows “Search again” back to catalog search. */
  searchAgainHref?: string | null
  showBack: boolean
  showContinue: boolean
  continueLabel?: string
  onBack: () => void
  onContinue: () => void
  disabled?: boolean
  className?: string
}

/**
 * Sell form chrome at the bottom of the page: Guided / Advanced / Quick picker,
 * optional “Search again”, and Guided Next / Back.
 */
export function BoardSellViewToolbar({
  viewMode,
  onViewModeChange,
  onSelectQuickList,
  searchAgainHref = null,
  showBack,
  showContinue,
  continueLabel = "Continue",
  onBack,
  onContinue,
  disabled = false,
  className,
}: BoardSellViewToolbarProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-t border-border pt-6 sm:pt-8",
        className,
      )}
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex h-10 items-center gap-1.5 rounded-full border border-border bg-background px-3.5 text-sm font-semibold text-foreground shadow-sm",
              "outline-none transition-colors hover:bg-muted/60",
              "focus-visible:ring-2 focus-visible:ring-listingHeart/30 focus-visible:ring-offset-2",
            )}
            disabled={disabled}
            aria-label="Listing form view mode"
          >
            {boardSellViewModeLabel(viewMode)}
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[12rem]">
          <DropdownMenuRadioGroup
            value={viewMode === "quick" ? "" : viewMode}
            onValueChange={(value) => {
              const next = value === "advanced" ? "advanced" : "guided"
              onViewModeChange(next)
            }}
          >
            <DropdownMenuRadioItem value="guided" className="gap-2 pl-8">
              <span className="flex flex-col gap-0.5">
                <span className="font-medium">Guided view</span>
                <span className="text-xs font-normal text-muted-foreground">
                  One step at a time
                </span>
              </span>
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="advanced" className="gap-2 pl-8">
              <span className="flex flex-col gap-0.5">
                <span className="font-medium">Advanced view</span>
                <span className="text-xs font-normal text-muted-foreground">
                  Full form, one page
                </span>
              </span>
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          {onSelectQuickList ? (
            <DropdownMenuItem
              className="relative gap-2 pl-8"
              onSelect={() => {
                onSelectQuickList()
              }}
            >
              {viewMode === "quick" ? (
                <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                  <Circle className="h-2 w-2 fill-current" aria-hidden />
                </span>
              ) : null}
              <span className="flex flex-col gap-0.5">
                <span className="font-medium">Quick list</span>
                <span className="text-xs font-normal text-muted-foreground">
                  Photo, price, publish
                </span>
              </span>
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-3 sm:gap-4">
        {searchAgainHref ? (
          <p className="hidden text-sm text-muted-foreground sm:block">
            Not what you&apos;re looking for?{" "}
            <Link
              href={searchAgainHref}
              className="font-medium text-foreground underline underline-offset-4 hover:text-listingHeart"
            >
              Search again
            </Link>
          </p>
        ) : null}
        {searchAgainHref ? (
          <Link
            href={searchAgainHref}
            className="text-sm font-medium text-foreground underline underline-offset-4 hover:text-listingHeart sm:hidden"
          >
            Search again
          </Link>
        ) : null}

        {viewMode === "guided" ? (
          <div className="flex items-center gap-2">
            {showBack ? (
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="h-10 gap-1 rounded-full px-4 text-sm"
                onClick={onBack}
                disabled={disabled}
              >
                <ChevronLeft className="h-4 w-4" aria-hidden />
                Back
              </Button>
            ) : null}
            {showContinue ? (
              <Button
                type="button"
                size="lg"
                className={cn(
                  "h-10 min-w-[6.5rem] gap-1 rounded-full px-5 text-sm",
                  SELL_PRIMARY_BUTTON_CLASS,
                )}
                onClick={onContinue}
                disabled={disabled}
              >
                {continueLabel}
                <ChevronRight className="h-4 w-4" aria-hidden />
              </Button>
            ) : null}
          </div>
        ) : viewMode === "advanced" ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground sm:text-sm">
            <Check className="h-3.5 w-3.5 text-listingHeart" aria-hidden />
            Full form
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground sm:text-sm">
            <Check className="h-3.5 w-3.5 text-listingHeart" aria-hidden />
            Photo, price, publish
          </span>
        )}
      </div>
    </div>
  )
}
