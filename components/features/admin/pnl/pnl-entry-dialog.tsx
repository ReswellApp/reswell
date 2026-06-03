"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { PnlEntryRow, PnlStatus } from "@/lib/db/pnl"
import { createPnlEntryAction, updatePnlEntryAction } from "@/lib/actions/pnlAdmin"

interface PnlEntryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  entry: PnlEntryRow | null
  onSaved: (row: PnlEntryRow) => void
}

interface FormState {
  boardName: string
  category: string
  status: PnlStatus
  purchaseDate: string
  purchasePrice: string
  shippingCost: string
  platformFee: string
  otherCosts: string
  saleDate: string
  salePrice: string
  notes: string
}

function emptyForm(): FormState {
  return {
    boardName: "",
    category: "",
    status: "inventory",
    purchaseDate: "",
    purchasePrice: "",
    shippingCost: "",
    platformFee: "",
    otherCosts: "",
    saleDate: "",
    salePrice: "",
    notes: "",
  }
}

function fromEntry(entry: PnlEntryRow): FormState {
  const num = (v: number | null) => (v == null ? "" : String(v))
  return {
    boardName: entry.board_name,
    category: entry.category ?? "",
    status: entry.status,
    purchaseDate: entry.purchase_date ?? "",
    purchasePrice: num(entry.purchase_price),
    shippingCost: num(entry.shipping_cost),
    platformFee: num(entry.platform_fee),
    otherCosts: num(entry.other_costs),
    saleDate: entry.sale_date ?? "",
    salePrice: num(entry.sale_price),
    notes: entry.notes ?? "",
  }
}

export function PnlEntryDialog({ open, onOpenChange, entry, onSaved }: PnlEntryDialogProps) {
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const isEdit = entry != null

  useEffect(() => {
    if (open) setForm(entry ? fromEntry(entry) : emptyForm())
  }, [open, entry])

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  async function handleSubmit() {
    if (!form.boardName.trim()) {
      toast.error("Board name is required")
      return
    }
    setSaving(true)
    const payload = {
      boardName: form.boardName,
      category: form.category,
      status: form.status,
      purchasePrice: form.purchasePrice,
      purchaseDate: form.purchaseDate,
      salePrice: form.salePrice === "" ? null : form.salePrice,
      saleDate: form.saleDate,
      shippingCost: form.shippingCost,
      platformFee: form.platformFee,
      otherCosts: form.otherCosts,
      notes: form.notes,
    }
    const result = isEdit
      ? await updatePnlEntryAction({ id: entry!.id, ...payload })
      : await createPnlEntryAction(payload)
    setSaving(false)

    if ("error" in result) {
      toast.error(result.error)
      return
    }
    toast.success(isEdit ? "Board updated" : "Board added")
    onSaved(result.data)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit board" : "Add board"}</DialogTitle>
          <DialogDescription>
            Track what you paid, what you sold it for, and your fees. Profit is calculated for you.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="pnl-board-name">Board name</Label>
            <Input
              id="pnl-board-name"
              value={form.boardName}
              onChange={(e) => set("boardName", e.target.value)}
              placeholder="e.g. Album Asym Goldfish 5'6"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="pnl-category">Category</Label>
              <Input
                id="pnl-category"
                value={form.category}
                onChange={(e) => set("category", e.target.value)}
                placeholder="Shortboard"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pnl-status">Status</Label>
              <Select value={form.status} onValueChange={(v) => set("status", v as PnlStatus)}>
                <SelectTrigger id="pnl-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inventory">Inventory</SelectItem>
                  <SelectItem value="listed">Listed</SelectItem>
                  <SelectItem value="sold">Sold</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <fieldset className="grid gap-3 rounded-lg border p-3">
            <legend className="px-1 text-xs font-medium text-muted-foreground">Buying</legend>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="pnl-purchase-price">Purchase price</Label>
                <Input
                  id="pnl-purchase-price"
                  inputMode="decimal"
                  value={form.purchasePrice}
                  onChange={(e) => set("purchasePrice", e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="pnl-purchase-date">Purchase date</Label>
                <Input
                  id="pnl-purchase-date"
                  type="date"
                  value={form.purchaseDate}
                  onChange={(e) => set("purchaseDate", e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="pnl-shipping">Shipping</Label>
                <Input
                  id="pnl-shipping"
                  inputMode="decimal"
                  value={form.shippingCost}
                  onChange={(e) => set("shippingCost", e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="pnl-fee">Platform fee</Label>
                <Input
                  id="pnl-fee"
                  inputMode="decimal"
                  value={form.platformFee}
                  onChange={(e) => set("platformFee", e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="pnl-other">Other costs</Label>
                <Input
                  id="pnl-other"
                  inputMode="decimal"
                  value={form.otherCosts}
                  onChange={(e) => set("otherCosts", e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>
          </fieldset>

          <fieldset className="grid gap-3 rounded-lg border p-3">
            <legend className="px-1 text-xs font-medium text-muted-foreground">Selling</legend>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="pnl-sale-price">Sale price</Label>
                <Input
                  id="pnl-sale-price"
                  inputMode="decimal"
                  value={form.salePrice}
                  onChange={(e) => set("salePrice", e.target.value)}
                  placeholder="Leave blank if unsold"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="pnl-sale-date">Sale date</Label>
                <Input
                  id="pnl-sale-date"
                  type="date"
                  value={form.saleDate}
                  onChange={(e) => set("saleDate", e.target.value)}
                />
              </div>
            </div>
          </fieldset>

          <div className="grid gap-2">
            <Label htmlFor="pnl-notes">Notes</Label>
            <Textarea
              id="pnl-notes"
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Condition, buyer, repairs, etc."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit ? "Save changes" : "Add board"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
