"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { addGoogleKeywordAction, type AdsActionResult } from "@/lib/actions/adsManager"
import { AdsField } from "@/components/features/admin/ads-manager/ads-manager-ui"

export function AdsKeywordDialog({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onDone: (result: AdsActionResult) => void
}) {
  const [adGroupId, setAdGroupId] = useState("")
  const [text, setText] = useState("")
  const [matchType, setMatchType] = useState<"EXACT" | "PHRASE" | "BROAD">("PHRASE")
  const [pending, setPending] = useState(false)

  async function submit() {
    setPending(true)
    const result = await addGoogleKeywordAction({ adGroupId: adGroupId.trim(), text, matchType })
    setPending(false)
    onDone(result)
    if ("success" in result) onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Google keyword</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <AdsField label="Ad group id" hint="The numeric id from the ad group row.">
            <Input value={adGroupId} onChange={(event) => setAdGroupId(event.target.value)} />
          </AdsField>
          <AdsField label="Keyword">
            <Input value={text} onChange={(event) => setText(event.target.value)} />
          </AdsField>
          <AdsField label="Match type">
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={matchType}
              onChange={(event) => {
                const value = event.target.value
                if (value === "EXACT" || value === "PHRASE" || value === "BROAD") setMatchType(value)
              }}
            >
              <option value="PHRASE">Phrase</option>
              <option value="EXACT">Exact</option>
              <option value="BROAD">Broad</option>
            </select>
          </AdsField>
        </div>
        <DialogFooter>
          <Button type="button" disabled={pending} onClick={() => void submit()}>
            {pending ? "Adding…" : "Add keyword"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
