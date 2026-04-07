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
  const [websiteUrl, setWebsiteUrl] = React.useState("")
  const [founderName, setFounderName] = React.useState("")
  const [leadShaperName, setLeadShaperName] = React.useState("")
  const [locationLabel, setLocationLabel] = React.useState("")
  const [about, setAbout] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    setName(defaultName.trim())
    setShortDescription("")
    setWebsiteUrl("")
    setFounderName("")
    setLeadShaperName("")
    setLocationLabel("")
    setAbout("")
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
      if (websiteUrl.trim()) fd.set("websiteUrl", websiteUrl.trim())
      if (founderName.trim()) fd.set("founderName", founderName.trim())
      if (leadShaperName.trim()) fd.set("leadShaperName", leadShaperName.trim())
      if (locationLabel.trim()) fd.set("locationLabel", locationLabel.trim())
      if (about.trim()) fd.set("about", about.trim())

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
      toast.success("Request received. Our team will review it. You can finish and publish your listing now.")
      onOpenChange(false)
      onSubmitted?.()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90vh,720px)] overflow-y-auto sm:max-w-lg">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Request a brand</DialogTitle>
            <DialogDescription>
              Only the brand name is required. Other fields are optional. We review requests before they appear in the
              directory; you can publish your listing anytime without a directory link.
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
            <div className="space-y-1.5">
              <Label htmlFor="rb-web" className="text-muted-foreground">
                Website <span className="font-normal">(optional)</span>
              </Label>
              <Input
                id="rb-web"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://"
                inputMode="url"
                maxLength={500}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="rb-founder" className="text-muted-foreground">
                  Founder <span className="font-normal">(optional)</span>
                </Label>
                <Input
                  id="rb-founder"
                  value={founderName}
                  onChange={(e) => setFounderName(e.target.value)}
                  maxLength={200}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rb-shaper" className="text-muted-foreground">
                  Lead shaper <span className="font-normal">(optional)</span>
                </Label>
                <Input
                  id="rb-shaper"
                  value={leadShaperName}
                  onChange={(e) => setLeadShaperName(e.target.value)}
                  maxLength={200}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rb-loc" className="text-muted-foreground">
                Location <span className="font-normal">(optional)</span>
              </Label>
              <Input
                id="rb-loc"
                value={locationLabel}
                onChange={(e) => setLocationLabel(e.target.value)}
                placeholder="City, region"
                maxLength={200}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rb-about" className="text-muted-foreground">
                About <span className="font-normal">(optional)</span>
              </Label>
              <Textarea
                id="rb-about"
                value={about}
                onChange={(e) => setAbout(e.target.value)}
                rows={4}
                maxLength={12000}
                placeholder="Separate paragraphs with a blank line."
                className="resize-y min-h-[5rem]"
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
