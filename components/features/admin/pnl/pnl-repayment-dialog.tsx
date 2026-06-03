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
import type { PnlLoanRepaymentRow, PnlLoanWithRepayments } from "@/lib/db/pnlLoans"
import { createLoanRepaymentAction } from "@/lib/actions/pnlAdmin"

interface PnlRepaymentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  loans: PnlLoanWithRepayments[]
  /** Preselect this loan when opened from a specific loan row. */
  defaultLoanId?: string | null
  onSaved: (loanId: string, repayment: PnlLoanRepaymentRow) => void
}

export function PnlRepaymentDialog({
  open,
  onOpenChange,
  loans,
  defaultLoanId,
  onSaved,
}: PnlRepaymentDialogProps) {
  const [loanId, setLoanId] = useState("")
  const [amount, setAmount] = useState("")
  const [paidOn, setPaidOn] = useState("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setLoanId(defaultLoanId ?? loans[0]?.id ?? "")
      setAmount("")
      setPaidOn(new Date().toISOString().slice(0, 10))
      setNotes("")
    }
  }, [open, defaultLoanId, loans])

  async function handleSubmit() {
    if (!loanId) {
      toast.error("Select a loan")
      return
    }
    setSaving(true)
    const result = await createLoanRepaymentAction({ loanId, amount, paidOn, notes })
    setSaving(false)
    if ("error" in result) {
      toast.error(result.error)
      return
    }
    toast.success("Repayment logged")
    onSaved(loanId, result.data)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Log repayment</DialogTitle>
          <DialogDescription>
            Record money paid back to the lender. This lowers your outstanding balance.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="repay-loan">Loan</Label>
            <Select value={loanId} onValueChange={setLoanId}>
              <SelectTrigger id="repay-loan">
                <SelectValue placeholder="Select a loan" />
              </SelectTrigger>
              <SelectContent>
                {loans.map((loan) => (
                  <SelectItem key={loan.id} value={loan.id}>
                    {loan.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="repay-amount">Amount</Label>
              <Input
                id="repay-amount"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="repay-date">Paid on</Label>
              <Input
                id="repay-date"
                type="date"
                value={paidOn}
                onChange={(e) => setPaidOn(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="repay-notes">Notes</Label>
            <Textarea
              id="repay-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Optional"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Log repayment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
