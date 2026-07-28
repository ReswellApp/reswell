"use client"

import { useState } from "react"
import Link from "next/link"
import { Heart, Loader2, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSignInGate } from "@/components/auth/use-sign-in-gate"
import { createBoardSavedSearchAction } from "@/lib/actions/boardSavedSearch"
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
    default:
      return "listing"
  }
}

/**
 * Empty-results CTA: save the current browse/search filters and enable email alerts
 * (Klaviyo `Board Alert Match` when a matching listing goes live).
 * Signed-out users get the same auth gate as favorites.
 */
export function BoardsNoResultsSaveSearch({
  criteria,
  isLoggedIn,
  className,
  clearHref,
}: {
  criteria: BoardSavedSearchCriteria
  isLoggedIn: boolean
  className?: string
  /** Optional clear-filters link (defaults from criteria.section). */
  clearHref?: string
}) {
  const openSignIn = useSignInGate()
  const { toast } = useToast()
  const [pending, setPending] = useState(false)
  const [saved, setSaved] = useState(false)
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

  return (
    <div className={cn("py-8 sm:py-12", className)}>
      <section
        className="rounded-2xl bg-neutral-100 px-6 py-12 text-center sm:px-10 sm:py-16"
        aria-labelledby="boards-no-results-save-heading"
      >
        <h2
          id="boards-no-results-save-heading"
          className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl"
        >
          Let the Gear Come to You
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-sm text-foreground/80 sm:text-base">
          Save this search and we&apos;ll email you when a matching {noun} is listed on Reswell.
        </p>
        <Button
          type="button"
          variant="outline"
          className="mt-6 rounded-full bg-background px-5 font-medium shadow-none"
          disabled={pending || saved}
          onClick={() => void handleSave()}
        >
          {pending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              Saving…
            </>
          ) : saved ? (
            <>
              <Check className="mr-2 h-4 w-4" aria-hidden />
              Search Saved
            </>
          ) : (
            <>
              <Heart className="mr-2 h-4 w-4" aria-hidden />
              Save Search
            </>
          )}
        </Button>
      </section>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link href={resolvedClearHref} className="underline underline-offset-2 hover:text-foreground">
          Clear filters
        </Link>
        {" · "}
        Try adjusting your search
      </p>
    </div>
  )
}
