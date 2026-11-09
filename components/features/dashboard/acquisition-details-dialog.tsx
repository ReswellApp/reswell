"use client"

import { useId, useState } from "react"
import { useRouter } from "next/navigation"
import { Pencil } from "lucide-react"
import { toast } from "sonner"
import { updateListingAcquisitionAction } from "@/lib/actions/sellerBalanceSheet"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface AcquisitionDetailsDialogProps {
  listingId: string
  listingTitle: string
  purchasePrice: number | null
  purchasedFrom: string | null
  purchasedOn: string | null
  trigger: "price" | "button"
}

function priceLabel(value: number | null): string {
  if (value == null) return "Not added"
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value)
}

export function AcquisitionDetailsDialog({
  listingId,
  listingTitle,
  purchasePrice,
  purchasedFrom,
  purchasedOn,
  trigger,
}: AcquisitionDetailsDialogProps) {
  const id = useId()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [price, setPrice] = useState(purchasePrice == null ? "" : String(purchasePrice))
  const [source, setSource] = useState(purchasedFrom ?? "")
  const [date, setDate] = useState(purchasedOn ?? "")

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    try {
      const result = await updateListingAcquisitionAction({
        listingId,
        purchasePrice: price,
        purchasedFrom: source,
        purchasedOn: date,
      })

      if ("error" in result) {
        toast.error(result.error)
        return
      }

      toast.success("Purchase details updated")
      setOpen(false)
      router.refresh()
    } catch {
      toast.error("Could not save purchase details. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger === "price" ? (
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-sm font-medium tabular-nums hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {priceLabel(purchasePrice)}
            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        ) : (
          <Button type="button" variant="outline" size="sm" className="w-full">
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            Edit purchase details
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit purchase details</DialogTitle>
          <DialogDescription>
            {listingTitle}. Sale price, Reswell fee, and profit remain automatic.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`${id}-price`}>Price paid</Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                $
              </span>
              <Input
                id={`${id}-price`}
                type="number"
                inputMode="decimal"
                min="0"
                max="999999.99"
                step="0.01"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                className="pl-8"
                placeholder="0.00"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${id}-source`}>Bought from</Label>
            <Input
              id={`${id}-source`}
              value={source}
              onChange={(event) => setSource(event.target.value)}
              maxLength={200}
              placeholder="Shop, seller, or marketplace"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${id}-date`}>Date purchased</Label>
            <Input
              id={`${id}-date`}
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
