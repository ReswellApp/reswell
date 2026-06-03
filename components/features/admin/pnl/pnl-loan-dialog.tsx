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
import type { PnlLoanRow } from "@/lib/db/pnlLoans"
import { createLoanAction, updateLoanAction } from "@/lib/actions/pnlAdmin"

interface PnlLoanDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  loan: PnlLoanRow | null
  onSaved: (loan: PnlLoanRow) => void
}

interface FormState {
  name: string
  principal: string
  interestRate: string
  lender: string
  startedOn: string
  notes: string
}

function emptyForm(): FormState {
  return { name: "", principal: "", interestRate: "", lender: "", startedOn: "", notes: "" }
}

function fromLoan(loan: PnlLoanRow): FormState {
  return {
    name: loan.name,
    principal: String(loan.principal),
    interestRate: loan.interest_rate == null ? "" : String(loan.interest_rate),
    lender: loan.lender ?? "",
    startedOn: loan.started_on ?? "",
    notes: loan.notes ?? "",
  }
}

export function PnlLoanDialog({ open, onOpenChange, loan, onSaved }: PnlLoanDialogProps) {
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const isEdit = loan != null

  useEffect(() => {
    if (open) setForm(loan ? fromLoan(loan) : emptyForm())
  }, [open, loan])

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  async function handleSubmit() {
    if (!form.name.trim()) {
      toast.error("Loan name is required")
      return
    }
    setSaving(true)
    const payload = {
      name: form.name,
      principal: form.principal,
      interestRate: form.interestRate === "" ? null : form.interestRate,
      lender: form.lender,
      startedOn: form.startedOn,
      notes: form.notes,
    }
    const result = isEdit
      ? await updateLoanAction({ id: loan!.id, ...payload })
      : await createLoanAction(payload)
    setSaving(false)

    if ("error" in result) {
      toast.error(result.error)
      return
    }
    toast.success(isEdit ? "Loan updated" : "Loan added")
    onSaved(result.data)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit loan" : "Add loan"}</DialogTitle>
          <DialogDescription>
            Track money loaned to fund inventory. The principal feeds your available capital.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="loan-name">Loan name</Label>
            <Input
              id="loan-name"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Surfboard inventory loan"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="loan-principal">Principal</Label>
              <Input
                id="loan-principal"
                inputMode="decimal"
                value={form.principal}
                onChange={(e) => set("principal", e.target.value)}
                placeholder="10000"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="loan-rate">Interest rate %</Label>
              <Input
                id="loan-rate"
                inputMode="decimal"
                value={form.interestRate}
                onChange={(e) => set("interestRate", e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="loan-lender">Lender</Label>
              <Input
                id="loan-lender"
                value={form.lender}
                onChange={(e) => set("lender", e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="loan-date">Start date</Label>
              <Input
                id="loan-date"
                type="date"
                value={form.startedOn}
                onChange={(e) => set("startedOn", e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="loan-notes">Notes</Label>
            <Textarea
              id="loan-notes"
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={2}
              placeholder="Terms, due date, etc."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit ? "Save changes" : "Add loan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
