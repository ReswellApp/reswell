"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"
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
import { toast } from "sonner"
import { LISTING_BOARD_MODEL_MAX_LENGTH } from "@/lib/sell-form-validation"

export type ListingCatalogRequestVariant =
  | "full"
  | { modelOnlyWithDirectoryBrandId: string }

export type RequestBrandModelDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** `full`: queue a brand request + a catalog model request using typed brand. Else: only request a model under an existing directory brand. */
  variant: ListingCatalogRequestVariant
  defaultBrandName: string
  defaultModelName: string
  /** After a successful submission; pass the brand string the seller submitted (full flow). */
  onBrandSubmitted?: (brandName: string) => void
}

function isModelOnly(v: ListingCatalogRequestVariant): v is {
  modelOnlyWithDirectoryBrandId: string
} {
  return typeof v === "object" && v !== null && "modelOnlyWithDirectoryBrandId" in v
}

export function RequestBrandModelDialog({
  open,
  onOpenChange,
  variant,
  defaultBrandName,
  defaultModelName,
  onBrandSubmitted,
}: RequestBrandModelDialogProps) {
  const [brandName, setBrandName] = React.useState("")
  const [modelName, setModelName] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)
  const wasOpenRef = React.useRef(false)

  React.useEffect(() => {
    if (!open) {
      wasOpenRef.current = false
      return
    }
    if (!wasOpenRef.current) {
      setBrandName(defaultBrandName.trim())
      setModelName(defaultModelName.trim())
    }
    wasOpenRef.current = true
  }, [open, defaultBrandName, defaultModelName])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    e.stopPropagation()

    if (isModelOnly(variant)) {
      const trimmedModel = modelName.trim()
      if (!trimmedModel) {
        toast.error("Enter a model name.")
        return
      }
      const brandId = variant.modelOnlyWithDirectoryBrandId.trim()
      if (!brandId) {
        toast.error("Missing directory brand link.")
        return
      }
      setSubmitting(true)
      try {
        const res = await fetch("/api/brand-model-requests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            brandId,
            requestedModelName: trimmedModel,
          }),
          credentials: "include",
        })
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        if (!res.ok) {
          toast.error(data.error || "Request failed.")
          return
        }
        toast.success("Thanks — we’ll review adding this model.")
        onOpenChange(false)
      } finally {
        setSubmitting(false)
      }
      return
    }

    const trimmedBrand = brandName.trim()
    const trimmedModel = modelName.trim()
    if (!trimmedBrand) {
      toast.error("Enter a brand name.")
      return
    }
    if (!trimmedModel) {
      toast.error("Enter a model name.")
      return
    }

    setSubmitting(true)
    try {
      const brandFd = new FormData()
      brandFd.set("name", trimmedBrand)

      const modelBody = {
        sellerBrandName: trimmedBrand,
        requestedModelName: trimmedModel,
      }

      const [brRes, mrRes] = await Promise.all([
        fetch("/api/brand-requests", {
          method: "POST",
          body: brandFd,
          credentials: "include",
        }),
        fetch("/api/brand-model-requests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(modelBody),
          credentials: "include",
        }),
      ])

      const brData = (await brRes.json().catch(() => ({}))) as { error?: string }
      const mrData = (await mrRes.json().catch(() => ({}))) as { error?: string }

      if (!brRes.ok && !mrRes.ok) {
        toast.error(brData.error || mrData.error || "Requests could not be saved.")
        return
      }
      if (!brRes.ok) {
        toast.error(
          brData.error ||
            "Brand request failed. Your model request was still saved — try the brand request again later.",
        )
        if (!mrRes.ok) {
          toast.error(mrData.error || "Model request also failed.")
        } else {
          toast.success("Model request received.")
        }
        return
      }
      if (!mrRes.ok) {
        toast.error(
          mrData.error ||
            "Brand request received, but the model request didn’t go through. Try “Model not listed?” again.",
        )
        onBrandSubmitted?.(trimmedBrand)
        onOpenChange(false)
        return
      }

      toast.success("Thanks — we received your brand and model requests.")
      onBrandSubmitted?.(trimmedBrand)
      onOpenChange(false)
    } finally {
      setSubmitting(false)
    }
  }

  const modelOnly = isModelOnly(variant)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90vh,520px)] overflow-y-auto sm:max-w-md">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>{modelOnly ? "Request a model" : "Request brand & model"}</DialogTitle>
            <DialogDescription>
              {modelOnly ?
                <>
                  Ask us to add this surfboard model to our catalog for the brand you linked above. You can still
                  publish your listing anytime.
                </>
              : <>
                  Tell us the maker and model to add — one submit sends both requests. You can publish your listing
                  anytime.
                </>
              }
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            {!modelOnly ?
              <div className="space-y-1.5">
                <Label htmlFor="rbm-brand">
                  Brand name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="rbm-brand"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  required
                  maxLength={200}
                  autoComplete="organization"
                  autoFocus
                />
              </div>
            : (
              <p className="text-sm text-muted-foreground">
                Brand in directory:{" "}
                <span className="font-medium text-foreground">{defaultBrandName.trim() || "—"}</span>
              </p>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="rbm-model">
                Model name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="rbm-model"
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                required
                maxLength={LISTING_BOARD_MODEL_MAX_LENGTH}
                autoComplete="off"
                autoFocus={modelOnly}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ?
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending…
                </>
              : "Submit request"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
