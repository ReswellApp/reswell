"use client"

import { useSearchParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import {
  createBoardSavedSearchAction,
  deleteBoardSavedSearchAction,
  listBoardSavedSearchesAction,
  type BoardSavedSearchListItem,
} from "@/lib/actions/boardSavedSearch"
import type { BoardSavedSearchCriteria } from "@/lib/validations/boardSavedSearch"
import { boardSavedCriteriaHasSpecificity, BOARD_SAVED_SEARCHES_MAX } from "@/lib/validations/boardSavedSearch"
import { BOARDS_BROWSE_DEFAULT_SORT } from "@/lib/marketplace-slug-metadata"
import { boardSavedSearchCriteriaFromFilters } from "@/lib/utils/board-saved-search-criteria"
import type { BoardsBrowseFilterFields } from "@/lib/utils/board-saved-search-criteria"
import {
  boardSavedSearchCriteriaSummary,
  boardSavedSearchCriteriaToBrowseHref,
} from "@/lib/utils/board-saved-search-browse-url"
import { siteFilterSelectTriggerClassName } from "@/components/site-search-bar"
import { isBenignClientFetchError } from "@/lib/utils/is-abort-error"
import { Bookmark, Loader2, Mail, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"

function boardsCriteriaFromSearchParams(sp: URLSearchParams): BoardSavedSearchCriteria {
  const fields: BoardsBrowseFilterFields = {
    q: sp.get("q") ?? "",
    brand: sp.get("brand") ?? "",
    model: sp.get("model") ?? "",
    catalogBrandId: sp.get("brandId") ?? "",
    catalogBrandModelId: sp.get("brandModelId") ?? "",
    boardLength: sp.get("dimLength") ?? "",
    boardWidthInches: sp.get("dimWidth") ?? "",
    boardThicknessInches: sp.get("dimThickness") ?? "",
    boardVolumeL: sp.get("dimVolume") ?? "",
    type: sp.get("type") ?? "all",
    condition: sp.get("condition") ?? "all",
    sort: sp.get("sort") ?? BOARDS_BROWSE_DEFAULT_SORT,
    minPrice: sp.get("minPrice") ?? "",
    maxPrice: sp.get("maxPrice") ?? "",
  }
  return boardSavedSearchCriteriaFromFilters(fields)
}

export function BoardsSaveSearchPanel({
  className,
  criteria: criteriaProp,
  variant = "panel",
}: {
  className?: string
  /** Live filter state; falls back to URL when omitted. */
  criteria?: BoardSavedSearchCriteria
  /** Compact horizontal pills for the mobile advanced filter slider. */
  variant?: "panel" | "slider"
}) {
  const sp = useSearchParams()
  const { toast } = useToast()
  const [emailOptIn, setEmailOptIn] = useState(false)
  const [pending, setPending] = useState(false)
  const [savedSearches, setSavedSearches] = useState<BoardSavedSearchListItem[]>([])
  const [savedLoading, setSavedLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isSignedIn, setIsSignedIn] = useState(false)

  const criteria = useMemo(
    () => criteriaProp ?? boardsCriteriaFromSearchParams(sp),
    [criteriaProp, sp],
  )
  const canSave = boardSavedCriteriaHasSpecificity(criteria)
  const summary = boardSavedSearchCriteriaSummary(criteria)
  const atSavedLimit = savedSearches.length >= BOARD_SAVED_SEARCHES_MAX

  const refreshSavedSearches = useCallback(async () => {
    setSavedLoading(true)
    try {
      const res = await listBoardSavedSearchesAction()
      if ("error" in res) {
        setSavedSearches([])
        return
      }
      setSavedSearches(res.data)
    } catch (err) {
      setSavedSearches([])
      if (!isBenignClientFetchError(err)) {
        console.error("Could not load saved searches:", err)
      }
    } finally {
      setSavedLoading(false)
    }
  }, [])

  useEffect(() => {
    const supabase = createClient()
    void supabase.auth.getUser().then(({ data: { user } }) => {
      setIsSignedIn(Boolean(user))
    })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsSignedIn(Boolean(session?.user))
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    void refreshSavedSearches()
  }, [refreshSavedSearches])

  async function handleSave() {
    setPending(true)
    const res = await createBoardSavedSearchAction({
      criteria,
      emailNotificationsEnabled: emailOptIn,
    })
    setPending(false)
    if ("error" in res) {
      toast({
        title: "Could not save",
        description: res.error,
        variant: "destructive",
      })
      return
    }
    toast({
      title: emailOptIn ? "Saved — watch your inbox" : "Search saved",
      description: emailOptIn
        ? "We’ll email you when a matching board is listed anywhere on Reswell."
        : "Tap it below anytime to run this search again.",
    })
    setEmailOptIn(false)
    await refreshSavedSearches()
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    const res = await deleteBoardSavedSearchAction({ id })
    setDeletingId(null)
    if ("error" in res) {
      toast({
        title: "Could not remove",
        description: res.error,
        variant: "destructive",
      })
      return
    }
    toast({ title: "Saved search removed" })
    await refreshSavedSearches()
  }

  if (variant === "slider") {
    const emailOptInDisabled = !canSave || atSavedLimit || !isSignedIn

    return (
      <>
        <div
          className={cn(
            siteFilterSelectTriggerClassName(),
            "inline-flex w-auto shrink-0 items-center gap-2 px-3",
            emailOptInDisabled && "opacity-60",
          )}
        >
          <Checkbox
            id="board-save-email-opt-in-slider"
            checked={emailOptIn}
            onCheckedChange={(v) => setEmailOptIn(v === true)}
            disabled={emailOptInDisabled}
            aria-label="Email me when a board matches"
          />
          <Label
            htmlFor="board-save-email-opt-in-slider"
            className={cn(
              "whitespace-nowrap text-sm font-normal leading-none",
              emailOptInDisabled ? "cursor-not-allowed" : "cursor-pointer",
            )}
          >
            Email alerts
          </Label>
        </div>

        {!isSignedIn ? (
          <Link
            href="/auth/login?redirect=%2Fboards"
            className={cn(
              siteFilterSelectTriggerClassName(),
              "inline-flex w-auto shrink-0 items-center justify-center px-4 text-sm no-underline",
            )}
          >
            Sign in to save
          </Link>
        ) : (
          <Button
            type="button"
            variant="outline"
            className={cn(siteFilterSelectTriggerClassName(), "w-auto shrink-0 px-4 text-sm")}
            disabled={pending || !canSave || atSavedLimit}
            onClick={() => void handleSave()}
            title={canSave ? summary : "Add filters to save this search"}
          >
            {pending ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />
                Saving…
              </>
            ) : atSavedLimit ? (
              "3 saved max"
            ) : (
              "Save search"
            )}
          </Button>
        )}

        {savedLoading ? (
          <span
            className={cn(
              siteFilterSelectTriggerClassName(),
              "inline-flex w-auto shrink-0 items-center px-4 text-sm text-muted-foreground",
            )}
          >
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />
            Loading…
          </span>
        ) : (
          savedSearches.map((saved) => {
            const label = saved.label?.trim() || boardSavedSearchCriteriaSummary(saved.criteria)
            const href = boardSavedSearchCriteriaToBrowseHref(saved.criteria)
            return (
              <div key={saved.id} className="flex shrink-0 items-center gap-1">
                <Link
                  href={href}
                  className={cn(
                    siteFilterSelectTriggerClassName(),
                    "inline-flex w-auto max-w-[12rem] items-center gap-2 px-3 text-sm no-underline",
                  )}
                  title={label}
                >
                  <Bookmark className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                  <span className="truncate">{label}</span>
                  {saved.emailNotificationsEnabled ? (
                    <Mail className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                  ) : null}
                </Link>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cn(
                    siteFilterSelectTriggerClassName(),
                    "w-12 shrink-0 px-0 text-muted-foreground hover:text-destructive",
                  )}
                  aria-label={`Remove saved search: ${label}`}
                  disabled={deletingId === saved.id}
                  onClick={() => void handleDelete(saved.id)}
                >
                  {deletingId === saved.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Trash2 className="h-4 w-4" aria-hidden />
                  )}
                </Button>
              </div>
            )
          })
        )}
      </>
    )
  }

  return (
    <section
      className={cn(className)}
      aria-labelledby="boards-save-search-heading"
    >
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-background border border-border">
          <Bookmark className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <h3 id="boards-save-search-heading" className="text-sm font-semibold text-foreground">
            Save this search
          </h3>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Save up to {BOARD_SAVED_SEARCHES_MAX} searches to revisit later or get emailed when new
            boards match. Alerts are nationwide — location filters above only affect results on this
            page.
          </p>
          <p className="text-xs text-foreground/80 pt-0.5">{summary}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-start gap-3">
          <Checkbox
            id="board-save-email-opt-in"
            checked={emailOptIn}
            onCheckedChange={(v) => setEmailOptIn(v === true)}
            className="mt-0.5"
            disabled={!canSave || atSavedLimit}
          />
          <div className="space-y-1">
            <Label
              htmlFor="board-save-email-opt-in"
              className={cn(
                "text-sm font-medium leading-snug",
                canSave && !atSavedLimit
                  ? "cursor-pointer"
                  : "cursor-not-allowed text-muted-foreground",
              )}
            >
              Email me when a board matches
            </Label>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {isSignedIn ? (
                "Uses your account email."
              ) : (
                <>
                  Uses your account email.{" "}
                  <Link
                    href="/auth/login?redirect=%2Fboards"
                    className="underline underline-offset-2 hover:text-foreground"
                  >
                    Sign in
                  </Link>{" "}
                  to save.
                </>
              )}
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          className="shrink-0 rounded-full"
          disabled={pending || !canSave || atSavedLimit}
          onClick={() => void handleSave()}
        >
          {pending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : atSavedLimit ? (
            "3 saved — remove one"
          ) : (
            "Save search"
          )}
        </Button>
      </div>

      <div className="mt-4 border-t border-border/80 pt-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h4 className="text-xs font-medium text-foreground/90">Your saved searches</h4>
          {!savedLoading ? (
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {savedSearches.length}/{BOARD_SAVED_SEARCHES_MAX}
            </span>
          ) : null}
        </div>

        {savedLoading ? (
          <p className="text-xs text-muted-foreground">Loading saved searches…</p>
        ) : savedSearches.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No saved searches yet. Set filters above and tap Save search.
          </p>
        ) : (
          <ul className="space-y-2">
            {savedSearches.map((saved) => {
              const label =
                saved.label?.trim() || boardSavedSearchCriteriaSummary(saved.criteria)
              const href = boardSavedSearchCriteriaToBrowseHref(saved.criteria)
              return (
                <li key={saved.id}>
                  <div className="flex items-stretch gap-1 rounded-xl border border-border/80 bg-background/60 pr-1">
                    <Link
                      href={href}
                      className={cn(
                        "min-w-0 flex-1 rounded-xl px-3 py-2.5 text-left transition-colors",
                        "hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cerulean/20",
                      )}
                    >
                      <span className="flex items-start gap-2">
                        <Bookmark
                          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground"
                          aria-hidden
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-medium leading-snug text-foreground">
                            {label}
                          </span>
                          <span className="mt-0.5 block text-[11px] text-muted-foreground">
                            Tap to run this search
                            {saved.emailNotificationsEnabled ? (
                              <>
                                {" "}
                                ·{" "}
                                <span className="inline-flex items-center gap-0.5">
                                  <Mail className="inline h-3 w-3" aria-hidden />
                                  email alerts on
                                </span>
                              </>
                            ) : null}
                          </span>
                        </span>
                      </span>
                    </Link>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="my-1 h-8 w-8 shrink-0 rounded-full text-muted-foreground hover:text-destructive"
                      aria-label={`Remove saved search: ${label}`}
                      disabled={deletingId === saved.id}
                      onClick={() => void handleDelete(saved.id)}
                    >
                      {deletingId === saved.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      )}
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}
