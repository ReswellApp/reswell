"use client"

import { useEffect, useLayoutEffect, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { Loader2 } from "lucide-react"
import {
  HomePeerListingScrollTile,
  type HomePeerScrollListing,
} from "@/components/features/home/home-peer-listing-scroll-tile"
import { ListingTileSkeleton } from "@/components/listing-tile-skeleton"
import { Button } from "@/components/ui/button"
import { SELL_PRIMARY_BUTTON_CLASS } from "@/components/features/sell/sell-form-surface"
import { homeUniformScrollCarouselTileWrapClass } from "@/lib/home-listing-scroll-styles"
import { cn } from "@/lib/utils"

export type SellListingPublishedScreenStatus = "publishing" | "live" | "error"

export type SellListingPublishedScreenProps = {
  listing: HomePeerScrollListing
  viewerUserId: string | null
  status: SellListingPublishedScreenStatus
  errorMessage?: string
  failedStepLabel?: string
  onContinue: () => void
  onExit: () => void
  onRetry?: () => void
  onDismissError?: () => void
}

function PublishTileColumn({
  children,
  className,
  decorative = false,
}: {
  children: ReactNode
  className?: string
  decorative?: boolean
}) {
  return (
    <div
      className={cn(homeUniformScrollCarouselTileWrapClass, className)}
      aria-hidden={decorative || undefined}
    >
      {children}
    </div>
  )
}

function SellListingPublishedInterior({
  listing,
  viewerUserId,
  status,
  errorMessage,
  failedStepLabel,
  onContinue,
  onExit,
  onRetry,
  onDismissError,
}: SellListingPublishedScreenProps) {
  const isLive = status === "live"
  const isError = status === "error"
  const heading = isError
    ? "Couldn't publish your listing"
    : isLive
      ? "Your listing is live"
      : "Publishing your listing"
  const subcopy = isError
    ? [failedStepLabel, errorMessage].filter(Boolean).join(" — ") ||
      "Something went wrong. You can retry or go back to the form."
    : "This is how it looks on Reswell."

  return (
    <div className="flex w-full max-w-5xl flex-col items-center px-4 py-10 sm:px-6">
      <div className="mb-8 max-w-lg space-y-2 text-center sm:mb-10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {isError ? "Publish failed" : isLive ? "Live" : "Publishing"}
        </p>
        <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {heading}
        </h2>
        <p className="text-sm text-muted-foreground sm:text-base" aria-live="polite">
          {status === "publishing" ? (
            <span className="inline-flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
              {subcopy}
            </span>
          ) : (
            subcopy
          )}
        </p>
      </div>

      <div className="w-full overflow-hidden">
        <div className="pointer-events-none flex items-stretch justify-center gap-3" inert>
          <PublishTileColumn decorative>
            <ListingTileSkeleton layout="homeScroll" index={0} />
          </PublishTileColumn>
          <PublishTileColumn className="relative z-10">
            <HomePeerListingScrollTile
              key={listing.id}
              listing={listing}
              userId={viewerUserId}
              isFavorited={false}
              layout="homeScroll"
              imagePriority
            />
          </PublishTileColumn>
          <PublishTileColumn decorative>
            <ListingTileSkeleton layout="homeScroll" index={1} />
          </PublishTileColumn>
        </div>
      </div>

      <div className="mt-10 flex w-full max-w-md flex-col-reverse gap-3 sm:mt-12 sm:flex-row sm:justify-center">
        {isError ? (
          <>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="h-12 min-w-[7.5rem] px-6 text-base"
              onClick={onDismissError}
            >
              Back
            </Button>
            <Button
              type="button"
              size="lg"
              className={cn(SELL_PRIMARY_BUTTON_CLASS, "min-w-[7.5rem]")}
              onClick={onRetry}
            >
              Retry
            </Button>
          </>
        ) : (
          <>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="h-12 min-w-[7.5rem] px-6 text-base"
              onClick={onExit}
              disabled={!isLive}
            >
              Exit
            </Button>
            <Button
              type="button"
              size="lg"
              className={cn(SELL_PRIMARY_BUTTON_CLASS, "min-w-[7.5rem]")}
              onClick={onContinue}
              disabled={!isLive}
            >
              Continue
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

/**
 * Full-viewport publish gate. User stays here until Continue / Exit (or Back / Retry on error).
 */
export function SellListingPublishedScreen(props: SellListingPublishedScreenProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useLayoutEffect(() => {
    if (!mounted) return
    const prev = document.documentElement.style.overflow
    document.documentElement.style.overflow = "hidden"
    return () => {
      document.documentElement.style.overflow = prev
    }
  }, [mounted])

  if (!mounted || typeof document === "undefined") {
    return null
  }

  const label =
    props.status === "error"
      ? "Publish failed"
      : props.status === "live"
        ? "Your listing is live"
        : "Publishing listing"

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center overflow-y-auto overscroll-none bg-background motion-safe:animate-in motion-safe:fade-in motion-reduce:animate-none duration-200"
      role="dialog"
      aria-modal="true"
      aria-busy={props.status === "publishing"}
      aria-label={label}
    >
      <SellListingPublishedInterior {...props} />
    </div>,
    document.body,
  )
}
