"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { createAdsCampaignAction, type AdsActionResult } from "@/lib/actions/adsManager"
import { parseYoutubeId } from "@/lib/ads/manager/media"
import {
  AdsGoogleCreateFields,
  EMPTY_GOOGLE_DRAFT,
  lines,
  type GoogleDraft,
} from "@/components/features/admin/ads-manager/ads-google-create-fields"
import {
  AdsMetaCreateFields,
  EMPTY_META_DRAFT,
  type MetaDraft,
} from "@/components/features/admin/ads-manager/ads-meta-create-fields"

export function AdsCreateDialog({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onDone: (result: AdsActionResult) => void
}) {
  const [platform, setPlatform] = useState<"google" | "meta">("google")
  const [google, setGoogle] = useState<GoogleDraft>(EMPTY_GOOGLE_DRAFT)
  const [meta, setMeta] = useState<MetaDraft>(EMPTY_META_DRAFT)
  const [pending, setPending] = useState(false)

  async function submit() {
    const payload = platform === "google" ? googlePayload(google) : { ok: true as const, body: metaPayload(meta) }
    if (!payload.ok) {
      onDone({ error: payload.error })
      return
    }
    setPending(true)
    const result = await createAdsCampaignAction(payload.body)
    setPending(false)
    onDone(result)
    if ("success" in result) onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New paused campaign</DialogTitle>
          <DialogDescription>
            Google creates a paused Search or Performance Max campaign. Meta creates a paused link ad, with an
            uploaded image or an https URL. A video also needs a thumbnail. Nothing spends until you enable it.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant={platform === "google" ? "default" : "outline"} onClick={() => setPlatform("google")}>
            Google
          </Button>
          <Button type="button" size="sm" variant={platform === "meta" ? "default" : "outline"} onClick={() => setPlatform("meta")}>
            Meta
          </Button>
        </div>
        {platform === "google" ? (
          <AdsGoogleCreateFields draft={google} onChange={setGoogle} />
        ) : (
          <AdsMetaCreateFields draft={meta} onChange={setMeta} />
        )}
        <DialogFooter>
          <Button type="button" disabled={pending} onClick={() => void submit()}>
            {pending ? "Creating…" : "Create paused"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function googlePayload(draft: GoogleDraft): { ok: true; body: Record<string, unknown> } | { ok: false; error: string } {
  if (draft.campaignKind === "pmax") {
    const youtube = draft.youtube.trim()
    const youtubeVideoId = youtube ? parseYoutubeId(youtube) : null
    if (youtube && !youtubeVideoId) return { ok: false, error: "Use a YouTube link or 11-character id" }
    return {
      ok: true,
      body: {
        kind: "google_pmax",
        name: draft.name,
        dailyBudget: Number(draft.dailyBudget),
        finalUrl: draft.finalUrl,
        headlines: lines(draft.headlines),
        longHeadlines: lines(draft.longHeadlines),
        descriptions: lines(draft.descriptions),
        businessName: draft.businessName,
        marketingImage: draft.marketingImage,
        squareImage: draft.squareImage,
        logo: draft.logo,
        ...(youtubeVideoId ? { youtubeVideoId } : {}),
      },
    }
  }
  return {
    ok: true,
    body: {
      kind: "google_search",
      name: draft.name,
      dailyBudget: Number(draft.dailyBudget),
      maxCpc: Number(draft.maxCpc),
      finalUrl: draft.finalUrl,
      headlines: lines(draft.headlines),
      descriptions: lines(draft.descriptions),
      keywords: lines(draft.keywords),
    },
  }
}

function metaPayload(draft: MetaDraft) {
  return {
    kind: "meta_link" as const,
    name: draft.name,
    objective: draft.objective,
    dailyBudget: Number(draft.dailyBudget),
    countries: draft.countries.split(",").map((code) => code.trim().toUpperCase()).filter(Boolean),
    finalUrl: draft.finalUrl,
    primaryText: draft.primaryText,
    headline: draft.headline,
    description: draft.description,
    ...(draft.imageUrl.trim() ? { imageUrl: draft.imageUrl.trim() } : {}),
    ...(draft.imageHash.trim() ? { imageHash: draft.imageHash.trim() } : {}),
    ...(draft.videoId.trim() ? { videoId: draft.videoId.trim() } : {}),
  }
}
