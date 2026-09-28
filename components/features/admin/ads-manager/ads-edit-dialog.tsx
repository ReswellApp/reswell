"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { removeAdsEntityAction, updateAdsEntityAction, type AdsActionResult } from "@/lib/actions/adsManager"
import { AdsField } from "@/components/features/admin/ads-manager/ads-manager-ui"
import type { AdsTableRow } from "@/components/features/admin/ads-manager/ads-entity-table"
import type { ManagedAd } from "@/lib/types/adsManager"

export function AdsEditDialog({
  row,
  ad,
  onOpenChange,
  onDone,
}: {
  row: AdsTableRow | null
  ad: ManagedAd | null
  onOpenChange: (open: boolean) => void
  onDone: (result: AdsActionResult) => void
}) {
  const [name, setName] = useState("")
  const [budget, setBudget] = useState("")
  const [finalUrl, setFinalUrl] = useState("")
  const [headlines, setHeadlines] = useState("")
  const [descriptions, setDescriptions] = useState("")
  const [primaryText, setPrimaryText] = useState("")
  const [headline, setHeadline] = useState("")
  const [description, setDescription] = useState("")
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    setName(row?.name ?? "")
    setBudget("")
    setFinalUrl(ad?.finalUrl ?? "")
    setHeadlines(ad?.headlines.join("\n") ?? "")
    setDescriptions(ad?.descriptions.join("\n") ?? "")
    setPrimaryText(ad?.primaryText ?? "")
    setHeadline(ad?.headlines[0] ?? "")
    setDescription(ad?.descriptions[0] ?? "")
    setConfirmRemove(false)
  }, [row, ad])

  if (!row) return null
  const showBudget = row.entity === "campaign" || (row.entity === "ad_group" && row.kind === "ad_set")
  const showGoogleCopy = row.entity === "ad" && ad?.kind === "responsive_search"
  const showMetaCopy = row.entity === "ad" && ad?.kind === "meta_link"
  const showName = row.entity === "campaign" || row.entity === "ad_group" || showMetaCopy

  async function save() {
    if (!row) return
    setPending(true)
    const result = await updateAdsEntityAction({
      platform: row.platform,
      entity: row.entity,
      id: row.id,
      parentId: row.parentId,
      kind: row.kind,
      ...(showName && name.trim() && name !== row.name ? { name: name.trim() } : {}),
      ...(showBudget && budget.trim() ? { dailyBudget: Number(budget) } : {}),
      ...(showGoogleCopy
        ? {
            headlines: splitLines(headlines),
            descriptions: splitLines(descriptions),
            ...(finalUrl.trim() ? { finalUrl: finalUrl.trim() } : {}),
          }
        : {}),
      ...(showMetaCopy
        ? {
            primaryText: primaryText.trim(),
            headline: headline.trim(),
            description: description.trim(),
            ...(finalUrl.trim() ? { finalUrl: finalUrl.trim() } : {}),
          }
        : {}),
    })
    setPending(false)
    onDone(result)
    if ("success" in result) onOpenChange(false)
  }

  async function remove() {
    if (!row || !confirmRemove) return
    setPending(true)
    const result = await removeAdsEntityAction({
      platform: row.platform,
      entity: row.entity,
      id: row.id,
      parentId: row.parentId,
      kind: row.kind,
      confirm: true,
    })
    setPending(false)
    onDone(result)
    if ("success" in result) onOpenChange(false)
  }

  return (
    <Dialog open={row != null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit {row.name}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          {showName ? (
            <AdsField label="Name">
              <Input value={name} onChange={(event) => setName(event.target.value)} />
            </AdsField>
          ) : (
            <p className="text-sm text-muted-foreground">Keyword text stays as “{row.name}”. Pause or remove it, or add a new keyword.</p>
          )}
          {showBudget ? (
            <AdsField label="New daily budget" hint="Leave blank to keep the current budget.">
              <Input value={budget} inputMode="decimal" onChange={(event) => setBudget(event.target.value)} />
            </AdsField>
          ) : null}
          {showGoogleCopy ? (
            <>
              <AdsField label="Final URL">
                <Input value={finalUrl} onChange={(event) => setFinalUrl(event.target.value)} />
              </AdsField>
              <AdsField label="Headlines">
                <Textarea value={headlines} onChange={(event) => setHeadlines(event.target.value)} />
              </AdsField>
              <AdsField label="Descriptions">
                <Textarea value={descriptions} onChange={(event) => setDescriptions(event.target.value)} />
              </AdsField>
            </>
          ) : null}
          {showMetaCopy ? (
            <>
              <AdsField label="Primary text">
                <Textarea value={primaryText} onChange={(event) => setPrimaryText(event.target.value)} />
              </AdsField>
              <AdsField label="Headline">
                <Input value={headline} onChange={(event) => setHeadline(event.target.value)} />
              </AdsField>
              <AdsField label="Description">
                <Input value={description} onChange={(event) => setDescription(event.target.value)} />
              </AdsField>
              <AdsField label="Website URL">
                <Input value={finalUrl} onChange={(event) => setFinalUrl(event.target.value)} />
              </AdsField>
            </>
          ) : null}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={confirmRemove} onChange={(event) => setConfirmRemove(event.target.checked)} />
            I want to remove this from the ad account
          </label>
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="destructive" disabled={pending || !confirmRemove} onClick={() => void remove()}>
            Remove
          </Button>
          {row.entity === "keyword" ? null : (
            <Button type="button" disabled={pending} onClick={() => void save()}>
              {pending ? "Saving…" : "Save"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function splitLines(value: string): string[] {
  return value.split("\n").map((line) => line.trim()).filter(Boolean)
}
