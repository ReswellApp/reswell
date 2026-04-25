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

export type RequestBrandDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Prefilled brand name from title search */
  defaultName: string
  onSubmitted?: () => void
}

export function RequestBrandDialog({
  open,
  onOpenChange,
  defaultName,
  onSubmitted,
}: RequestBrandDialogProps) {
  const [name, setName] = React.useState("")
  const [shortDescription, setShortDescription] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    setName(defaultName.trim())
    setShortDescription("")
  }, [open, defaultName])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    e.stopPropagation()
    const trimmedName = name.trim()
    if (!trimmedName) {
      toast.error("Enter a brand name.")
      return
    }
    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.set("name", trimmedName)
      if (shortDescription.trim()) fd.set("shortDescription", shortDescription.trim())

      const res = await fetch("/api/brand-requests", {
        method: "POST",
        body: fd,
        credentials: "include",
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        toast.error(data.error || "Request failed.")
        return
      }
      onOpenChange(false)
      onSubmitted?.()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90vh,520px)] overflow-y-auto sm:max-w-md">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Request a brand</DialogTitle>
            <DialogDescription>
              Enter the brand name to request. A short description is optional. We review requests before they appear
              in the directory; you can publish your listing anytime without a directory link.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="rb-name">
                Brand name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="rb-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={200}
                autoComplete="organization"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rb-short" className="text-muted-foreground">
                Short description <span className="font-normal">(optional)</span>
              </Label>
              <Textarea
                id="rb-short"
                value={shortDescription}
                onChange={(e) => setShortDescription(e.target.value)}
                rows={2}
                maxLength={2000}
                placeholder="One or two sentences"
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
