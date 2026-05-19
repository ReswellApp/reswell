"use client"

import { useSearchParams } from "next/navigation"
import { useMemo, useState } from "react"
import Link from "next/link"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { createBoardSavedSearchAction } from "@/lib/actions/boardSavedSearch"
import type { BoardSavedSearchCriteria } from "@/lib/validations/boardSavedSearch"
import { boardSavedCriteriaHasSpecificity } from "@/lib/validations/boardSavedSearch"
import { BOARDS_BROWSE_DEFAULT_SORT } from "@/lib/marketplace-slug-metadata"
import { boardSavedSearchCriteriaFromFilters } from "@/lib/utils/board-saved-search-criteria"
import type { BoardsBrowseFilterFields } from "@/lib/utils/board-saved-search-criteria"
import { Loader2, Bookmark } from "lucide-react"
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

function criteriaSummary(criteria: BoardSavedSearchCriteria): string {
  const parts: string[] = []
  if (criteria.q?.trim()) parts.push(`“${criteria.q.trim()}”`)
  if (criteria.brand?.trim()) parts.push(criteria.brand.trim())
  if (criteria.model?.trim()) parts.push(criteria.model.trim())
  if (criteria.dimensions?.trim()) parts.push(criteria.dimensions.trim())
  if (criteria.minPrice != null) parts.push(`from $${criteria.minPrice}`)
  if (criteria.maxPrice != null) parts.push(`up to $${criteria.maxPrice}`)
  if (criteria.type && criteria.type !== "all") parts.push(criteria.type.replace(/-/g, " "))
  if (criteria.condition && criteria.condition !== "all") parts.push(criteria.condition.replace(/-/g, " "))
  return parts.length > 0 ? parts.join(" · ") : "Add filters above to save this search"
}

export function BoardsSaveSearchPanel({
  className,
  criteria: criteriaProp,
}: {
  className?: string
  /** Live filter state; falls back to URL when omitted. */
  criteria?: BoardSavedSearchCriteria
}) {
  const sp = useSearchParams()
  const { toast } = useToast()
  const [emailOptIn, setEmailOptIn] = useState(false)
  const [pending, setPending] = useState(false)

  const criteria = useMemo(
    () => criteriaProp ?? boardsCriteriaFromSearchParams(sp),
    [criteriaProp, sp],
  )
  const canSave = boardSavedCriteriaHasSpecificity(criteria)
  const summary = criteriaSummary(criteria)

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
        : "Your saved criteria are stored on your account.",
    })
    setEmailOptIn(false)
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
            Separate from browsing: save criteria to revisit later or get emailed when new boards match.
            Alerts are nationwide — location filters above only affect results on this page.
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
            disabled={!canSave}
          />
          <div className="space-y-1">
            <Label
              htmlFor="board-save-email-opt-in"
              className={cn(
                "text-sm font-medium leading-snug",
                canSave ? "cursor-pointer" : "cursor-not-allowed text-muted-foreground",
              )}
            >
              Email me when a board matches
            </Label>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Uses your account email.{" "}
              <Link
                href="/auth/login?redirect=%2Fboards"
                className="underline underline-offset-2 hover:text-foreground"
              >
                Sign in
              </Link>{" "}
              to save.
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          className="shrink-0 rounded-full"
          disabled={pending || !canSave}
          onClick={() => void handleSave()}
        >
          {pending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            "Save search"
          )}
        </Button>
      </div>
    </section>
  )
}
