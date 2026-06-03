"use client"

import { Banknote, Plus, Landmark } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatCurrency, type CapitalSummary } from "@/lib/pnl-calc"
import type { PnlLoanWithRepayments } from "@/lib/db/pnlLoans"
import { PnlLoanCard } from "./pnl-loan-card"

interface PnlFinancePanelProps {
  capital: CapitalSummary
  loans: PnlLoanWithRepayments[]
  onAddLoan: () => void
  onLogRepayment: (loanId?: string) => void
  onEditLoan: (loan: PnlLoanWithRepayments) => void
  onDeleteLoan: (loan: PnlLoanWithRepayments) => void
  onDeleteRepayment: (loanId: string, repaymentId: string) => void
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("mt-1 text-lg font-semibold tabular-nums", accent)}>{value}</div>
    </div>
  )
}

export function PnlFinancePanel({
  capital,
  loans,
  onAddLoan,
  onLogRepayment,
  onEditLoan,
  onDeleteLoan,
  onDeleteRepayment,
}: PnlFinancePanelProps) {
  const cashPositive = capital.cashAvailable >= 0
  const netPositive = capital.netPosition >= 0

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Landmark className="h-5 w-5 text-neutral-800" aria-hidden />
          Financing &amp; capital
        </CardTitle>
        <div className="flex gap-2">
          {loans.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => onLogRepayment(undefined)}>
              <Banknote className="mr-2 h-4 w-4" />
              Log repayment
            </Button>
          )}
          <Button size="sm" onClick={onAddLoan}>
            <Plus className="mr-2 h-4 w-4" />
            Add loan
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {loans.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            Add the loan you were given to buy boards. We&apos;ll track how much capital is left to
            deploy and how it fits into your P&amp;L.
          </div>
        ) : (
          <>
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Loan capital left to deploy
              </div>
              <div
                className={cn(
                  "mt-1 text-4xl font-bold tabular-nums",
                  cashPositive ? "text-emerald-600" : "text-rose-600",
                )}
              >
                {formatCurrency(capital.cashAvailable)}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                of {formatCurrency(capital.principal)} loaned ·{" "}
                {formatCurrency(capital.inventoryCostBasis)} tied up in inventory
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Stat label="Loaned" value={formatCurrency(capital.principal)} />
              <Stat label="Deployed" value={formatCurrency(capital.deployed)} />
              <Stat label="Recovered" value={formatCurrency(capital.recovered)} />
              <Stat label="Repaid" value={formatCurrency(capital.repaid)} />
              <Stat
                label="Outstanding"
                value={formatCurrency(capital.outstanding)}
                accent={capital.outstanding > 0 ? "text-rose-600" : "text-emerald-600"}
              />
              <Stat
                label="Net position"
                value={formatCurrency(capital.netPosition)}
                accent={netPositive ? "text-emerald-600" : "text-rose-600"}
              />
            </div>

            <div className="space-y-3">
              {loans.map((loan) => (
                <PnlLoanCard
                  key={loan.id}
                  loan={loan}
                  onEdit={onEditLoan}
                  onDelete={onDeleteLoan}
                  onLogRepayment={(loanId) => onLogRepayment(loanId)}
                  onDeleteRepayment={onDeleteRepayment}
                />
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
