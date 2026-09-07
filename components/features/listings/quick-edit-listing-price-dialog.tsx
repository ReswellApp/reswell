"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ListingPriceMarkdownToggle } from "@/components/features/listings/listing-price-markdown-toggle"
import { patchListingQuickPrice } from "@/lib/listing-quick-price-request"
import {
  listingCompareAtPriceForDisplay,
  parseOptionalUsdAmount,
  resolveCompareAtPriceOnUpdate,
} from "@/lib/listing-compare-at-price"
import { toast } from "sonner"

function formatUsdInput(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return ""
  const rounded = Math.round(amount * 100) / 100
  return String(rounded)
}

function parsePriceInput(raw: string): number | null {
  const t = raw.trim().replace(/[$,]/g, "")
  if (t === "") return null
  const n = Number.parseFloat(t)
  return Number.isFinite(n) ? n : null
}

interface QuickEditListingPriceDialogProps {
  listingId: string
  currentPriceUsd: number
  currentCompareAtPriceUsd?: number | null
  triggerClassName?: string
}

export function QuickEditListingPriceDialog({
  listingId,
  currentPriceUsd,
  currentCompareAtPriceUsd = null,
  triggerClassName,
}: QuickEditListingPriceDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [priceRaw, setPriceRaw] = useState("")
  const [showPriceMarkdown, setShowPriceMarkdown] = useState(false)
  const [loading, setLoading] = useState(false)

  const existingCompareAt = listingCompareAtPriceForDisplay(
    currentPriceUsd,
    currentCompareAtPriceUsd,
  )

  useEffect(() => {
    if (open) {
      setPriceRaw(formatUsdInput(currentPriceUsd))
      setShowPriceMarkdown(existingCompareAt != null)
    }
  }, [open, currentPriceUsd, existingCompareAt])

  const parsedNext = parsePriceInput(priceRaw)
  const nextUsd =
    parsedNext != null && parsedNext > 0 ? Math.round(parsedNext * 100) / 100 : null
  const canOfferMarkdown =
    nextUsd != null &&
    (nextUsd < currentPriceUsd ||
      (existingCompareAt != null && existingCompareAt > nextUsd))
  const previewCompareAt =
    nextUsd != null && showPriceMarkdown
      ? resolveCompareAtPriceOnUpdate({
          currentPriceUsd,
          nextPriceUsd: nextUsd,
          existingCompareAtUsd: parseOptionalUsdAmount(currentCompareAtPriceUsd),
          showPriceMarkdown: true,
        })
      : null

  const helperText = useMemo(() => {
    if (nextUsd == null) return null
    if (nextUsd < currentPriceUsd) return "Optional — only shown if you choose it."
    if (existingCompareAt != null && existingCompareAt > nextUsd) {
      return "Uncheck to hide the previous price on your listing."
    }
    return null
  }, [nextUsd, currentPriceUsd, existingCompareAt])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const parsed = parsePriceInput(priceRaw)
    if (parsed == null || parsed <= 0) {
      toast.error("Enter a valid price.")
      return
    }

    const rounded = Math.round(parsed * 100) / 100
    if (rounded < 0.01 || rounded > 999_999.99) {
      toast.error("Price must be between $0.01 and $999,999.99.")
      return
    }

    setLoading(true)
    try {
      const result = await patchListingQuickPrice(listingId, rounded, {
        showPriceMarkdown: canOfferMarkdown ? showPriceMarkdown : false,
      })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success("Price updated.")
      setOpen(false)
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className={triggerClassName}
        onClick={() => setOpen(true)}
        disabled={loading}
      >
        Quick edit
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={(e) => void handleSubmit(e)}>
            <DialogHeader>
              <DialogTitle>Quick edit price</DialogTitle>
              <DialogDescription>
                Update your list price. Buyers will see this amount on your listing immediately.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="quick-edit-list-price">Price (USD)</Label>
                <div className="relative">
                  <span
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground"
                    aria-hidden
                  >
                    $
                  </span>
                  <Input
                    id="quick-edit-list-price"
                    className="pl-7"
                    inputMode="decimal"
                    autoComplete="off"
                    aria-label="Listing price in US dollars"
                    value={priceRaw}
                    onChange={(ev) => setPriceRaw(ev.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>
              {canOfferMarkdown ? (
                <div className="space-y-1">
                  <ListingPriceMarkdownToggle
                    id="quick-edit-show-price-markdown"
                    checked={showPriceMarkdown}
                    onCheckedChange={setShowPriceMarkdown}
                    disabled={loading}
                    previewPriceUsd={nextUsd}
                    previewCompareAtUsd={previewCompareAt}
                  />
                  {helperText ? (
                    <p className="pl-7 text-xs text-muted-foreground">{helperText}</p>
                  ) : null}
                </div>
              ) : null}
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Saving…" : "Update price"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
