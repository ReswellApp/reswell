"use client"

import { MoreHorizontal, Pencil, Plus, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { formatCurrency, formatPercent } from "@/lib/pnl-calc"
import type { PnlLoanWithRepayments } from "@/lib/db/pnlLoans"

interface PnlLoanCardProps {
  loan: PnlLoanWithRepayments
  onEdit: (loan: PnlLoanWithRepayments) => void
  onDelete: (loan: PnlLoanWithRepayments) => void
  onLogRepayment: (loanId: string) => void
  onDeleteRepayment: (loanId: string, repaymentId: string) => void
}

function repaymentDate(value: string): string {
  const [y, m, d] = value.split("-").map(Number)
  if (!y || !m || !d) return value
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "2-digit",
    timeZone: "UTC",
  })
}

export function PnlLoanCard({
  loan,
  onEdit,
  onDelete,
  onLogRepayment,
  onDeleteRepayment,
}: PnlLoanCardProps) {
  const repaid = loan.repayments.reduce((sum, r) => sum + r.amount, 0)
  const outstanding = Math.max(0, loan.principal - repaid)
  const progress = loan.principal > 0 ? Math.min(100, (repaid / loan.principal) * 100) : 0
  const paidOff = outstanding <= 0 && loan.principal > 0

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium">{loan.name}</span>
            {paidOff && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                Paid off
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            {formatCurrency(loan.principal)}
            {loan.lender ? ` · ${loan.lender}` : ""}
            {loan.interest_rate != null ? ` · ${formatPercent(loan.interest_rate / 100)} APR` : ""}
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">Loan actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onLogRepayment(loan.id)}>
              <Plus className="mr-2 h-4 w-4" />
              Log repayment
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEdit(loan)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit loan
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-rose-600 focus:text-rose-600"
              onClick={() => onDelete(loan)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete loan
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-3">
        <Progress value={progress} className="h-2" />
        <div className="mt-1.5 flex justify-between text-xs">
          <span className="text-muted-foreground">
            Repaid <span className="font-medium text-foreground">{formatCurrency(repaid)}</span>
          </span>
          <span className="text-muted-foreground">
            Outstanding{" "}
            <span className="font-medium text-foreground">{formatCurrency(outstanding)}</span>
          </span>
        </div>
      </div>

      {loan.repayments.length > 0 && (
        <ul className="mt-3 space-y-1 border-t pt-2">
          {loan.repayments.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between gap-2 text-xs text-muted-foreground"
            >
              <span className="tabular-nums">
                {formatCurrency(r.amount)} · {repaymentDate(r.paid_on)}
                {r.notes ? ` · ${r.notes}` : ""}
              </span>
              <button
                type="button"
                onClick={() => onDeleteRepayment(loan.id, r.id)}
                className="rounded p-0.5 hover:bg-muted hover:text-rose-600"
                title="Remove repayment"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
