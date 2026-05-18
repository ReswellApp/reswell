"use client"

import { useSearchParams } from "next/navigation"
import { useState } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { createBoardSavedSearchAction } from "@/lib/actions/boardSavedSearch"
import type { BoardSavedSearchCriteria } from "@/lib/validations/boardSavedSearch"
import { BOARDS_BROWSE_DEFAULT_SORT } from "@/lib/marketplace-slug-metadata"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { isUuidString } from "@/lib/utils/isUuid"

function boardsCriteriaFromSearchParams(sp: URLSearchParams): BoardSavedSearchCriteria {
  const out: BoardSavedSearchCriteria = {}
  const q = sp.get("q")?.trim()
  if (q) out.q = q
  const brand = sp.get("brand")?.trim()
  if (brand) out.brand = brand
  const brandIdRaw = sp.get("brandId")?.trim()
  if (brandIdRaw && isUuidString(brandIdRaw)) out.brandId = brandIdRaw
  const model = sp.get("model")?.trim()
  if (model) out.model = model
  const brandModelIdRaw = sp.get("brandModelId")?.trim()
  if (brandModelIdRaw && isUuidString(brandModelIdRaw)) out.brandModelId = brandModelIdRaw
  const dimensions = sp.get("dimensions")?.trim()
  if (dimensions) out.dimensions = dimensions
  const type = sp.get("type")?.trim()
  if (type && type !== "all") out.type = type
  const condition = sp.get("condition")?.trim()
  if (condition && condition !== "all") out.condition = condition
  const sort = sp.get("sort")?.trim()
  if (sort && sort !== BOARDS_BROWSE_DEFAULT_SORT) out.sort = sort
  const minRaw = sp.get("minPrice")?.trim()
  if (minRaw) {
    const n = Number(minRaw)
    if (Number.isFinite(n) && n >= 0) out.minPrice = n
  }
  const maxRaw = sp.get("maxPrice")?.trim()
  if (maxRaw) {
    const n = Number(maxRaw)
    if (Number.isFinite(n) && n >= 0) out.maxPrice = n
  }
  return out
}

export function BoardsSaveSearchPanel({ className }: { className?: string }) {
  const sp = useSearchParams()
  const { toast } = useToast()
  const [emailOptIn, setEmailOptIn] = useState(false)
  const [pending, setPending] = useState(false)

  async function handleSave() {
    const criteria = boardsCriteriaFromSearchParams(sp)
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
        : "Keep this page bookmarked or copy the URL to run the same search again.",
    })
    setEmailOptIn(false)
  }

  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-muted/25 px-4 py-3 sm:px-5 sm:py-4",
        className,
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Checkbox
            id="board-save-email-opt-in"
            checked={emailOptIn}
            onCheckedChange={(v) => setEmailOptIn(v === true)}
            className="mt-0.5"
          />
          <div className="space-y-1">
            <Label htmlFor="board-save-email-opt-in" className="text-sm font-medium leading-snug cursor-pointer">
              Email me when a board matches these filters
            </Label>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Uses your account email. Alerts are nationwide — location filters on this page only affect browse results,
              not emails.
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="secondary"
          className="shrink-0 rounded-full"
          disabled={pending}
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
    </div>
  )
}
