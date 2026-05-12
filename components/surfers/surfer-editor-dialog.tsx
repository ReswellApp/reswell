"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { slugifySurferName } from "@/lib/surfers/slug"
import type { SurferRow, SurferQuiverItem } from "@/lib/surfers/types"
import { SURFERS_BASE } from "@/lib/surfers/routes"
import { createPreviewUrlForImageFile } from "@/lib/surfers/staged-image-preview-client"
import { uploadSurferPhotoFile } from "@/lib/surfers/upload-surfer-photo-client"
import { SurferEditorFormFields } from "@/components/surfers/surfer-editor-form-fields"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type Mode = "create" | "edit"

function paragraphsToAboutText(paragraphs: string[] | undefined): string {
  if (!paragraphs?.length) return ""
  return paragraphs.map((p) => p.trim()).filter(Boolean).join("\n\n")
}

export function SurferEditorDialog({
  open,
  onOpenChange,
  mode,
  surfer,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: Mode
  surfer: SurferRow | null
  onSaved?: () => void
}) {
  const router = useRouter()
  const [saving, setSaving] = React.useState(false)
  const [slug, setSlug] = React.useState("")
  const [name, setName] = React.useState("")
  const [shortDescription, setShortDescription] = React.useState("")
  const [instagramUrl, setInstagramUrl] = React.useState("")
  const [youtubeUrl, setYoutubeUrl] = React.useState("")
  const [photoUrl, setPhotoUrl] = React.useState("")
  const [locationLabel, setLocationLabel] = React.useState("")
  const [aboutText, setAboutText] = React.useState("")
  const [quiverItems, setQuiverItems] = React.useState<SurferQuiverItem[]>([])
  const [photoInputKey, setPhotoInputKey] = React.useState(0)
  const [photoFile, setPhotoFile] = React.useState<File | null>(null)
  const [photoPreviewUrl, setPhotoPreviewUrl] = React.useState<string | null>(null)
  const [photoPreviewLoading, setPhotoPreviewLoading] = React.useState(false)
  const [photoQuarterTurns, setPhotoQuarterTurns] = React.useState(0)
  const [quiverStagingResetKey, setQuiverStagingResetKey] = React.useState(0)
  const photoPreviewSeqRef = React.useRef(0)
  /** Avoid resetting form state when `surfer` RSC props refresh while the dialog stays open (wipes quiver captions). */
  const dialogWasOpenRef = React.useRef(false)

  React.useEffect(() => {
    if (!open) {
      dialogWasOpenRef.current = false
      setPhotoPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
      setPhotoFile(null)
      setPhotoPreviewLoading(false)
      setPhotoQuarterTurns(0)
      return
    }

    const justOpened = !dialogWasOpenRef.current
    dialogWasOpenRef.current = true
    if (!justOpened) {
      return
    }

    setPhotoPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
    photoPreviewSeqRef.current += 1
    setPhotoInputKey((k) => k + 1)
    setPhotoFile(null)
    setPhotoQuarterTurns(0)
    setPhotoPreviewLoading(false)
    setQuiverStagingResetKey((k) => k + 1)
    if (mode === "edit" && surfer) {
      setSlug(surfer.slug)
      setName(surfer.name)
      setShortDescription(surfer.short_description ?? "")
      setInstagramUrl(surfer.instagram_url ?? "")
      setYoutubeUrl(surfer.youtube_url ?? "")
      setPhotoUrl(surfer.photo_url ?? "")
      setLocationLabel(surfer.location_label ?? "")
      setAboutText(paragraphsToAboutText(surfer.about_paragraphs))
      setQuiverItems([...(surfer.quiver_items ?? [])])
    } else if (mode === "create") {
      setSlug("")
      setName("")
      setShortDescription("")
      setInstagramUrl("")
      setYoutubeUrl("")
      setPhotoUrl("")
      setLocationLabel("")
      setAboutText("")
      setQuiverItems([])
    }
  }, [open, mode, surfer])

  function handlePhotoFileChange(file: File | null) {
    photoPreviewSeqRef.current += 1
    const seq = photoPreviewSeqRef.current

    setPhotoPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
    setPhotoQuarterTurns(0)
    setPhotoFile(file)

    if (!file) {
      setPhotoPreviewLoading(false)
      return
    }

    setPhotoPreviewLoading(true)
    void (async () => {
      try {
        const { url } = await createPreviewUrlForImageFile(file)
        if (seq !== photoPreviewSeqRef.current) {
          URL.revokeObjectURL(url)
          return
        }
        setPhotoPreviewUrl(url)
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not show preview")
        if (seq === photoPreviewSeqRef.current) {
          setPhotoFile(null)
          setPhotoInputKey((k) => k + 1)
        }
      } finally {
        if (seq === photoPreviewSeqRef.current) {
          setPhotoPreviewLoading(false)
        }
      }
    })()
  }

  function clearPhotoPick() {
    handlePhotoFileChange(null)
    setPhotoInputKey((k) => k + 1)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (photoPreviewLoading) {
      toast.message("Wait for the photo preview to finish loading.")
      return
    }
    setSaving(true)
    try {
      let finalPhotoUrl = photoUrl.trim() || null
      if (photoFile) {
        const uploaded = await uploadSurferPhotoFile(photoFile, {
          rotateQuarterTurns: photoQuarterTurns,
        })
        if (!uploaded) {
          setSaving(false)
          return
        }
        finalPhotoUrl = uploaded
      }

      const about_paragraphs = aboutText
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter(Boolean)

      if (mode === "create") {
        const res = await fetch("/api/admin/surfers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slug: slug.trim(),
            name: name.trim(),
            short_description: shortDescription.trim() || null,
            instagram_url: instagramUrl.trim() || null,
            youtube_url: youtubeUrl.trim() || null,
            photo_url: finalPhotoUrl,
            location_label: locationLabel.trim() || null,
            about_paragraphs,
            quiver_items: quiverItems,
          }),
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) {
          toast.error(typeof json.error === "string" ? json.error : "Could not create profile")
          return
        }
        onOpenChange(false)
        onSaved?.()
        router.push(`${SURFERS_BASE}/${json.slug}`)
        router.refresh()
        return
      }

      if (!surfer) return
      const res = await fetch(`/api/admin/surfers/${encodeURIComponent(surfer.slug)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: slug.trim() !== surfer.slug ? slug.trim() : undefined,
          name: name.trim(),
          short_description: shortDescription.trim() || null,
          instagram_url: instagramUrl.trim() || null,
          youtube_url: youtubeUrl.trim() || null,
          photo_url: finalPhotoUrl,
          location_label: locationLabel.trim() || null,
          about_paragraphs,
          quiver_items: quiverItems,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(typeof json.error === "string" ? json.error : "Could not save")
        return
      }
      onOpenChange(false)
      onSaved?.()
      if (json.slug && json.slug !== surfer.slug) {
        router.push(`${SURFERS_BASE}/${json.slug}`)
      } else {
        router.refresh()
      }
    } finally {
      setSaving(false)
    }
  }

  function onNameBlur() {
    if (mode !== "create" || slug.trim().length > 0) return
    if (name.trim()) setSlug(slugifySurferName(name))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90vh,800px)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Add surfer" : "Edit surfer"}</DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Create a directory profile. Slug becomes the URL path."
              : "Changes apply immediately on save."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <SurferEditorFormFields
            idPrefix="surfer-editor"
            slug={slug}
            onSlugChange={setSlug}
            name={name}
            onNameChange={setName}
            onNameBlur={onNameBlur}
            shortDescription={shortDescription}
            onShortDescriptionChange={setShortDescription}
            instagramUrl={instagramUrl}
            onInstagramUrlChange={setInstagramUrl}
            youtubeUrl={youtubeUrl}
            onYoutubeUrlChange={setYoutubeUrl}
            photoUrl={photoUrl}
            onPhotoUrlChange={setPhotoUrl}
            photoInputKey={photoInputKey}
            photoPreviewUrl={photoPreviewUrl}
            photoPreviewLoading={photoPreviewLoading}
            photoQuarterTurns={photoQuarterTurns}
            onPhotoFileChange={handlePhotoFileChange}
            onPhotoRotateQuarterTurn={() => setPhotoQuarterTurns((q) => (q + 1) % 4)}
            onClearPhotoPick={clearPhotoPick}
            quiverStagingResetKey={quiverStagingResetKey}
            locationLabel={locationLabel}
            onLocationLabelChange={setLocationLabel}
            aboutText={aboutText}
            onAboutTextChange={setAboutText}
            quiverItems={quiverItems}
            onQuiverItemsChange={setQuiverItems}
          />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || photoPreviewLoading}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : mode === "create" ? (
                "Create"
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
