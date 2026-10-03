"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Heart, Loader2, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSignInGate } from "@/components/auth/use-sign-in-gate"
import {
  createBoardSavedSearchAction,
  listBoardSavedSearchesAction,
} from "@/lib/actions/boardSavedSearch"
import { savedSearchMatchesCriteria } from "@/lib/utils/saved-search-criteria-equal"
import {
  boardSavedCriteriaCanSaveFromEmptyState,
  type BoardSavedSearchCriteria,
} from "@/lib/validations/boardSavedSearch"
import type { PeerListingSection } from "@/lib/peer-listing-sections"
import { peerSectionBrowsePath } from "@/lib/utils/peer-saved-search-criteria"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

function matchingNoun(section: PeerListingSection | "any" | undefined): string {
  if (!section || section === "any") return "listing"
  switch (section) {
    case "surfboards":
      return "board"
    case "fins":
      return "fins"
    case "wetsuits":
      return "wetsuit"
    case "magazines":
      return "magazine"
    case "boardbags":
      return "boardbag"
    case "surfpacks":
      return "surfpack"
    case "leashes":
      return "leash"
    case "apparel":
      return "apparel"
    case "accessories":
      return "accessory"
    case "traction":
      return "traction"
    default:
      return "listing"
  }
}

/**
 * Save-search CTA: persist the current browse/search filters and enable email alerts
 * (Klaviyo `Board Alert Match` when a matching listing goes live).
 * Signed-out users get the same auth gate as favorites.
 *
 * `empty` is the large dead-end card. `compact` is a slim bar under matching results.
 */
export function BoardsNoResultsSaveSearch({
  criteria,
  isLoggedIn,
  className,
  clearHref,
  variant = "empty",
  initiallySaved = false,
}: {
  criteria: BoardSavedSearchCriteria
  isLoggedIn: boolean
  className?: string
  /** Optional clear-filters link (defaults from criteria.section). */
  clearHref?: string
  /** Large empty-state card, or a slim bar that sits under matching listings. */
  variant?: "empty" | "compact"
  /** True when this shopper already saved the same search. */
  initiallySaved?: boolean
}) {
  const openSignIn = useSignInGate()
  const { toast } = useToast()
  const [pending, setPending] = useState(false)
  const [saved, setSaved] = useState(initiallySaved)

  useEffect(() => {
    setSaved(initiallySaved)
  }, [initiallySaved])

  useEffect(() => {
    if (!isLoggedIn || initiallySaved) return
    let cancelled = false
    void listBoardSavedSearchesAction().then((res) => {
      if (cancelled || "error" in res) return
      if (savedSearchMatchesCriteria(res.data, criteria)) setSaved(true)
    })
    return () => {
      cancelled = true
    }
  }, [criteria, initiallySaved, isLoggedIn])
  const canSave = boardSavedCriteriaCanSaveFromEmptyState(criteria)
  const section = criteria.anySection
    ? "any"
    : (criteria.section as PeerListingSection | undefined) ?? "surfboards"
  const noun = matchingNoun(section)
  const resolvedClearHref =
    clearHref ?? (section === "any" ? "/search/recent" : peerSectionBrowsePath(section))

  async function handleSave() {
    if (!isLoggedIn) {
      openSignIn(undefined, { skipSessionProbe: true })
      return
    }

    if (!canSave) {
      toast({
        title: "Add a filter first",
        description: "Choose a keyword or filter before saving this search.",
        variant: "destructive",
      })
      return
    }

    setPending(true)
    const res = await createBoardSavedSearchAction({
      criteria,
      emailNotificationsEnabled: true,
    })
    setPending(false)

    if ("error" in res) {
      if (res.error === "Sign in to save a search.") {
        openSignIn()
        return
      }
      toast({
        title: "Could not save",
        description: res.error,
        variant: "destructive",
      })
      return
    }

    setSaved(true)
    toast({
      title: "Search saved",
      description: `We'll email you when a matching ${noun} is listed on Reswell.`,
    })
  }

  const compact = variant === "compact"
  const headingId = compact ? "boards-results-save-heading" : "boards-no-results-save-heading"

  return (
    <div className={cn(compact ? "mt-6 sm:mt-8" : "py-8 sm:py-12", className)}>
      <section
        className={cn(
          "bg-neutral-100",
          compact
            ? "flex flex-col items-center gap-3 rounded-xl px-4 py-3 text-center sm:flex-row sm:items-center sm:justify-between sm:gap-5 sm:px-5 sm:py-3 sm:text-left"
            : "rounded-2xl px-6 py-12 text-center sm:px-10 sm:py-16",
        )}
        aria-labelledby={headingId}
      >
        <div className={cn(compact && "min-w-0")}>
          <h2
            id={headingId}
            className={cn(
              "font-semibold tracking-tight text-foreground",
              compact ? "text-sm" : "text-xl sm:text-2xl",
            )}
          >
            Let the Gear Come to You
          </h2>
          <p
            className={cn(
              "text-foreground/80",
              compact
                ? "mt-0.5 text-xs leading-snug sm:text-sm"
                : "mx-auto mt-3 max-w-lg text-sm sm:text-base",
            )}
          >
            {saved
              ? compact
                ? `This search is saved. We'll email you when a new matching ${noun} is listed on Reswell.`
                : `This search is saved. We'll email you when a matching ${noun} is listed on Reswell.`
              : compact
                ? `Save this search and we'll email you when a new matching ${noun} is listed on Reswell.`
                : `Save this search and we'll email you when a matching ${noun} is listed on Reswell.`}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size={compact ? "sm" : "default"}
          className={cn(
            "shrink-0 rounded-full bg-background font-medium shadow-none",
            compact ? "h-8 px-3.5" : "mt-6 px-5",
          )}
          disabled={pending || saved}
          onClick={() => void handleSave()}
        >
          {pending ? (
            <>
              <Loader2 className={cn("animate-spin", compact ? "mr-1.5 h-3.5 w-3.5" : "mr-2 h-4 w-4")} aria-hidden />
              Saving…
            </>
          ) : saved ? (
            <>
              <Check className={cn(compact ? "mr-1.5 h-3.5 w-3.5" : "mr-2 h-4 w-4")} aria-hidden />
              Search Saved
            </>
          ) : (
            <>
              <Heart className={cn(compact ? "mr-1.5 h-3.5 w-3.5" : "mr-2 h-4 w-4")} aria-hidden />
              Save Search
            </>
          )}
        </Button>
      </section>
      {compact ? null : (
        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link href={resolvedClearHref} className="underline underline-offset-2 hover:text-foreground">
            Clear filters
          </Link>
          {" · "}
          Try adjusting your search
        </p>
      )}
    </div>
  )
}
