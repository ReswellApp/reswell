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
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"

export type RequestModelDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Directory brand id (`public.brands.id`) — required to submit. */
  brandId: string
  /** Shown for context (e.g. Channel Islands). */
  brandDisplayName: string
  /** Prefilled model name when the dialog opens. */
  defaultModelName: string
}

export function RequestModelDialog({
  open,
  onOpenChange,
  brandId,
  brandDisplayName,
  defaultModelName,
}: RequestModelDialogProps) {
  const [modelName, setModelName] = React.useState("")
  const [notes, setNotes] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)
  const wasOpenRef = React.useRef(false)

  React.useEffect(() => {
    if (!open) {
      wasOpenRef.current = false
      return
    }
    if (!wasOpenRef.current) {
      setModelName(defaultModelName.trim())
      setNotes("")
    }
    wasOpenRef.current = true
  }, [open, defaultModelName])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    e.stopPropagation()
    const trimmedModel = modelName.trim()
    if (!trimmedModel) {
      toast.error("Enter a model name.")
      return
    }
    if (!brandId.trim()) {
      toast.error("Choose a brand from our directory first.")
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch("/api/brand-model-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandId: brandId.trim(),
          requestedModelName: trimmedModel,
          notes: notes.trim() || undefined,
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
  }

  const brandLabel = brandDisplayName.trim() || "this brand"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90vh,520px)] overflow-y-auto sm:max-w-md">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Request a model</DialogTitle>
            <DialogDescription>
              Ask us to add a surfboard model to{" "}
              <span className="font-medium text-foreground">{brandLabel}</span> in our catalog. Optional notes help our
              team verify the shape name. You can still publish your listing anytime.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="rm-model">
                Model name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="rm-model"
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                required
                maxLength={200}
                autoComplete="off"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rm-notes" className="text-muted-foreground">
                Notes <span className="font-normal">(optional)</span>
              </Label>
              <Textarea
                id="rm-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                maxLength={2000}
                placeholder="Year range, alternate names, or links"
                className="resize-y min-h-[3rem]"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending…
                </>
              ) : (
                "Submit request"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
