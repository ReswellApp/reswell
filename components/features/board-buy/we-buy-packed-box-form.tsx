"use client"

import { useRouter } from "next/navigation"
import { useState, type FormEvent } from "react"
import { sellerSubmitBoardBuyParcelAction } from "@/lib/actions/boardBuyActions"
import {
  BOARD_BUY_MAX_BOX_HEIGHT_IN,
  BOARD_BUY_MAX_BOX_WIDTH_IN,
} from "@/lib/board-buy/constants"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function WeBuyPackedBoxForm({ submissionId }: { submissionId: string }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    setPending(true)
    setError(null)
    const result = await sellerSubmitBoardBuyParcelAction({
      submissionId,
      parcelLengthIn: Number(form.get("parcelLengthIn")),
      parcelWidthIn: Number(form.get("parcelWidthIn")),
      parcelHeightIn: Number(form.get("parcelHeightIn")),
      parcelWeightLb: Number(form.get("parcelWeightLb")),
    })
    setPending(false)
    if ("error" in result) {
      setError(result.error)
      return
    }
    router.refresh()
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-lg border p-4">
      <p className="text-sm font-medium">Packed box measurements</p>
      <p className="text-sm text-muted-foreground">
        Box the board first, then measure the outer carton. Max width{" "}
        {BOARD_BUY_MAX_BOX_WIDTH_IN}&quot; and max height {BOARD_BUY_MAX_BOX_HEIGHT_IN}&quot;. We
        purchase the prepaid label only after you submit these numbers.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="parcelLengthIn">Length (in)</Label>
          <Input id="parcelLengthIn" name="parcelLengthIn" required inputMode="decimal" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="parcelWidthIn">Width (in, max {BOARD_BUY_MAX_BOX_WIDTH_IN})</Label>
          <Input
            id="parcelWidthIn"
            name="parcelWidthIn"
            required
            inputMode="decimal"
            max={BOARD_BUY_MAX_BOX_WIDTH_IN}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="parcelHeightIn">Height (in, max {BOARD_BUY_MAX_BOX_HEIGHT_IN})</Label>
          <Input
            id="parcelHeightIn"
            name="parcelHeightIn"
            required
            inputMode="decimal"
            max={BOARD_BUY_MAX_BOX_HEIGHT_IN}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="parcelWeightLb">Weight (lb)</Label>
          <Input id="parcelWeightLb" name="parcelWeightLb" required inputMode="decimal" />
        </div>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Purchasing label…" : "Submit measurements and get label"}
      </Button>
    </form>
  )
}
