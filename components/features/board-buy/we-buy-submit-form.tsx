"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { submitBoardBuyAction } from "@/lib/actions/boardBuyActions"
import { WeBuyPhotoUploader } from "@/components/features/board-buy/we-buy-photo-uploader"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export function WeBuySubmitForm({ userId }: { userId: string }) {
  const router = useRouter()
  const [photoUrls, setPhotoUrls] = React.useState<string[]>([])
  const [error, setError] = React.useState<string | null>(null)
  const [pending, setPending] = React.useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const form = new FormData(e.currentTarget)
    const askingRaw = String(form.get("askingPrice") ?? "")
    const askingPrice = Number(askingRaw.replace(/[^0-9.]/g, ""))
    setPending(true)
    const result = await submitBoardBuyAction({
      title: String(form.get("title") ?? ""),
      askingPrice,
      sellerNote: String(form.get("sellerNote") ?? "") || null,
      photoUrls,
      shipFromName: String(form.get("shipFromName") ?? ""),
      shipFromPhone: String(form.get("shipFromPhone") ?? ""),
      shipFromLine1: String(form.get("shipFromLine1") ?? ""),
      shipFromLine2: String(form.get("shipFromLine2") ?? "") || null,
      shipFromCity: String(form.get("shipFromCity") ?? ""),
      shipFromState: String(form.get("shipFromState") ?? ""),
      shipFromPostal: String(form.get("shipFromPostal") ?? ""),
    })
    setPending(false)
    if ("error" in result) {
      setError(result.error)
      return
    }
    router.push(`/we-buy/quotes/${result.data.id}`)
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="rounded-lg border border-[#001A4A]/15 bg-[#F4F7FB] p-4 text-sm text-[#001A4A]">
        You will be required to ship this board in a box with a maximum width of 22 inches and a
        maximum height of 5 inches. After you accept an offer, box the board, measure the packed
        carton, and send those numbers — we purchase the shipping label then, not at accept.
      </div>
      <div className="space-y-2">
        <Label htmlFor="title">Board title</Label>
        <Input id="title" name="title" required placeholder="CI Twin Pin 5'10" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="askingPrice">Asking price (USD)</Label>
        <Input id="askingPrice" name="askingPrice" required inputMode="decimal" placeholder="650" />
      </div>
      <div className="space-y-2">
        <Label>Photos</Label>
        <WeBuyPhotoUploader userId={userId} urls={photoUrls} onChange={setPhotoUrls} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="sellerNote">Notes (optional)</Label>
        <Textarea id="sellerNote" name="sellerNote" rows={3} placeholder="Dings, fins, repairs…" />
      </div>

      <fieldset className="space-y-3 rounded-lg border p-4">
        <legend className="px-1 text-sm font-medium">Ship-from address</legend>
        <p className="text-xs text-muted-foreground">
          After you accept, you’ll box the board (max 22&quot; wide and 5&quot; high) and send us
          the packed measurements. We buy the prepaid label to Reswell from this address only after
          that.
        </p>
        <Input name="shipFromName" required placeholder="Full name" />
        <Input name="shipFromPhone" required placeholder="Phone" />
        <Input name="shipFromLine1" required placeholder="Address line 1" />
        <Input name="shipFromLine2" placeholder="Address line 2" />
        <div className="grid gap-3 sm:grid-cols-3">
          <Input name="shipFromCity" required placeholder="City" />
          <Input name="shipFromState" required placeholder="State" />
          <Input name="shipFromPostal" required placeholder="ZIP" />
        </div>
      </fieldset>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={pending} className="w-full rounded-full sm:w-auto">
        {pending ? "Submitting…" : "Get a quote in 30 minutes"}
      </Button>
    </form>
  )
}
