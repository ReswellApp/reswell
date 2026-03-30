"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Landmark,
  CreditCard,
  Mail,
  Coins,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Plus,
  Zap,
  Clock,
} from "lucide-react"
import { AddPaymentMethodDialog } from "./add-payment-method-dialog"

interface PaymentMethod {
  id: string
  type: "BANK_ACCOUNT" | "DEBIT_CARD" | "PAYPAL"
  is_default: boolean
  bank_name?: string
  account_last4?: string
  routing_last4?: string
  card_brand?: string
  card_last4?: string
  card_exp?: string
  paypal_email?: string
  verified: boolean
}

interface PayoutModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  availableBalance: number
  paymentMethods: PaymentMethod[]
  onSuccess: () => void
}

const INSTANT_FEE_PCT = 1.5
const INSTANT_FEE_MIN = 0.5

type PayoutMethod = "ACH" | "INSTANT" | "PAYPAL" | "RESWELL_CREDIT"

function methodForPaymentType(pm: PaymentMethod): PayoutMethod {
  if (pm.type === "DEBIT_CARD") return "INSTANT"
  if (pm.type === "PAYPAL") return "PAYPAL"
  return "ACH"
}

function pmIcon(type: string) {
  if (type === "BANK_ACCOUNT") return <Landmark className="h-4 w-4" />
  if (type === "DEBIT_CARD") return <CreditCard className="h-4 w-4" />
  if (type === "PAYPAL") return <Mail className="h-4 w-4" />
  return <Coins className="h-4 w-4" />
}

function pmLabel(pm: PaymentMethod): string {
  if (pm.type === "BANK_ACCOUNT") return `${pm.bank_name ?? "Bank"} ••••${pm.account_last4}`
  if (pm.type === "DEBIT_CARD") return `${pm.card_brand ?? "Card"} ••••${pm.card_last4}`
  if (pm.type === "PAYPAL") return pm.paypal_email ?? "PayPal"
  return "Unknown"
}

function pmArrival(pm: PaymentMethod): string {
  if (pm.type === "BANK_ACCOUNT") return "2–5 business days • Free"
  if (pm.type === "DEBIT_CARD") return "~30 minutes • 1.5% fee"
  if (pm.type === "PAYPAL") return "1–3 business days • Free"
  return ""
}

type Step = "amount" | "method" | "confirm" | "success"

export function PayoutModal({
  open,
  onOpenChange,
  availableBalance,
  paymentMethods: initialMethods,
  onSuccess,
}: PayoutModalProps) {
  const [step, setStep] = useState<Step>("amount")
  const [amount, setAmount] = useState(availableBalance.toFixed(2))
  const [selectedMethodId, setSelectedMethodId] = useState<string>("reswell_credit")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>(initialMethods)
  const [showAddMethod, setShowAddMethod] = useState(false)

  // Sync methods and default amount when modal opens
  useEffect(() => {
    if (open) {
      setPaymentMethods(initialMethods)
      setAmount(availableBalance.toFixed(2))
      setStep("amount")
      setError("")
      const defaultPm = initialMethods.find((m) => m.is_default)
      setSelectedMethodId(defaultPm?.id ?? "reswell_credit")
    }
  }, [open, initialMethods, availableBalance])

  const amountNum = parseFloat(amount) || 0

  const selectedPm = paymentMethods.find((m) => m.id === selectedMethodId)
  const payoutMethod: PayoutMethod = selectedPm
    ? methodForPaymentType(selectedPm)
    : "RESWELL_CREDIT"

  const fee =
    payoutMethod === "INSTANT"
      ? Math.max(INSTANT_FEE_MIN, Math.round(amountNum * INSTANT_FEE_PCT) / 100)
      : 0
  const netAmount = Math.round((amountNum - fee) * 100) / 100

  const minForMethod: Record<PayoutMethod, number> = {
    ACH: 10,
    INSTANT: 1,
    PAYPAL: 10,
    RESWELL_CREDIT: 0.01,
  }
  const currentMin = minForMethod[payoutMethod]

  const amountError =
    amountNum <= 0
      ? ""
      : amountNum > availableBalance
      ? `Exceeds available balance ($${availableBalance.toFixed(2)})`
      : amountNum < currentMin
      ? `Minimum for this method is $${currentMin.toFixed(2)}`
      : ""

  const canProceedToMethod = amountNum > 0 && amountNum <= availableBalance && !amountError

  const handleConfirm = async () => {
    setError("")
    setLoading(true)
    try {
      const res = await fetch("/api/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amountNum,
          method: payoutMethod,
          payment_method_id: selectedPm?.id ?? null,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? "Payout failed. Please try again.")
        return
      }

      setStep("success")
      onSuccess()
    } catch {
      setError("An unexpected error occurred")
    } finally {
      setLoading(false)
    }
  }

  const handleClose = (v: boolean) => {
    if (!loading) {
      onOpenChange(v)
      setTimeout(() => setStep("amount"), 300)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          {/* ── Step: Amount ── */}
          {step === "amount" && (
            <>
              <DialogHeader>
                <DialogTitle>Cash out</DialogTitle>
                <DialogDescription>How much would you like to withdraw?</DialogDescription>
              </DialogHeader>

              <div className="space-y-5 py-2">
                <div className="rounded-lg bg-muted/60 px-4 py-3 flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Available</span>
                  <span className="text-lg font-semibold">${availableBalance.toFixed(2)}</span>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="payout-amount">Amount</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <Input
                      id="payout-amount"
                      type="number"
                      step="0.01"
                      min="0.01"
                      max={availableBalance}
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="pl-7"
                      placeholder="0.00"
                    />
                  </div>
                  {amountError && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {amountError}
                    </p>
                  )}
                  <div className="flex justify-end">
                    <Button
                      variant="link"
                      size="sm"
                      className="text-xs p-0 h-auto"
                      onClick={() => setAmount(availableBalance.toFixed(2))}
                    >
                      Use full balance
                    </Button>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => handleClose(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => setStep("method")}
                  disabled={!canProceedToMethod}
                >
                  Choose method →
                </Button>
              </DialogFooter>
            </>
          )}

          {/* ── Step: Method ── */}
          {step === "method" && (
            <>
              <DialogHeader>
                <DialogTitle>Choose payout method</DialogTitle>
                <DialogDescription>
                  Cashing out ${amountNum.toFixed(2)} — select where to send it.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-2">
                <RadioGroup
                  value={selectedMethodId}
                  onValueChange={setSelectedMethodId}
                  className="space-y-2"
                >
                  {paymentMethods.map((pm) => (
                    <label
                      key={pm.id}
                      htmlFor={pm.id}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedMethodId === pm.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-muted-foreground/40"
                      }`}
                    >
                      <RadioGroupItem value={pm.id} id={pm.id} className="mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {pmIcon(pm.type)}
                          <span className="font-medium text-sm">{pmLabel(pm)}</span>
                          {pm.type === "DEBIT_CARD" && (
                            <span className="ml-auto flex items-center gap-1 text-xs text-amber-600">
                              <Zap className="h-3 w-3" />
                              Instant
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {pmArrival(pm)}
                        </p>
                      </div>
                    </label>
                  ))}

                  {/* Reswell credit option */}
                  <label
                    htmlFor="reswell_credit"
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedMethodId === "reswell_credit"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-muted-foreground/40"
                    }`}
                  >
                    <RadioGroupItem value="reswell_credit" id="reswell_credit" className="mt-0.5" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Coins className="h-4 w-4" />
                        <span className="font-medium text-sm">Keep as Reswell credit</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3 text-green-600" />
                        Instant • No fee • Use to buy gear
                      </p>
                    </div>
                  </label>
                </RadioGroup>

                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full border border-dashed"
                  onClick={() => setShowAddMethod(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add a payout method
                </Button>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setStep("amount")}>
                  ← Back
                </Button>
                <Button onClick={() => setStep("confirm")}>
                  Preview →
                </Button>
              </DialogFooter>
            </>
          )}

          {/* ── Step: Confirm ── */}
          {step === "confirm" && (
            <>
              <DialogHeader>
                <DialogTitle>Confirm payout</DialogTitle>
                <DialogDescription>Review the details before confirming.</DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                <div className="rounded-lg border p-4 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Payout amount</span>
                    <span className="font-medium">${amountNum.toFixed(2)}</span>
                  </div>
                  {fee > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Instant fee (1.5%)</span>
                      <span className="text-amber-600">−${fee.toFixed(2)}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between">
                    <span className="font-semibold">You receive</span>
                    <span className="font-bold text-lg">${netAmount.toFixed(2)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">To</span>
                    <span className="font-medium">
                      {selectedPm ? (
                        <span className="flex items-center gap-1.5">
                          {pmIcon(selectedPm.type)}
                          {pmLabel(selectedPm)}
                        </span>
                      ) : (
                        "Reswell credit"
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Arrives</span>
                    <span className="font-medium">
                      {payoutMethod === "INSTANT"
                        ? "Within 30 minutes"
                        : payoutMethod === "ACH"
                        ? "2–5 business days"
                        : payoutMethod === "PAYPAL"
                        ? "1–3 business days"
                        : "Instantly"}
                    </span>
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-2 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    {error}
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setStep("method")} disabled={loading}>
                  ← Back
                </Button>
                <Button onClick={handleConfirm} disabled={loading}>
                  {loading ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processing...</>
                  ) : (
                    `Confirm — $${netAmount.toFixed(2)}`
                  )}
                </Button>
              </DialogFooter>
            </>
          )}

          {/* ── Step: Success ── */}
          {step === "success" && (
            <>
              <DialogHeader>
                <DialogTitle>Payout initiated</DialogTitle>
              </DialogHeader>

              <div className="py-6 flex flex-col items-center text-center gap-3">
                <div className="h-14 w-14 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle2 className="h-7 w-7 text-green-600" />
                </div>
                <div>
                  <p className="text-xl font-bold">${netAmount.toFixed(2)}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {payoutMethod === "INSTANT"
                      ? "Arriving within 30 minutes"
                      : payoutMethod === "ACH"
                      ? "Arriving in 2–5 business days"
                      : payoutMethod === "PAYPAL"
                      ? "Arriving in 1–3 business days"
                      : "Added to your Reswell credit"}
                  </p>
                  {selectedPm && (
                    <p className="text-sm text-muted-foreground mt-0.5">
                      to {pmLabel(selectedPm)}
                    </p>
                  )}
                </div>
              </div>

              <DialogFooter>
                <Button className="w-full" onClick={() => handleClose(false)}>
                  Done
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AddPaymentMethodDialog
        open={showAddMethod}
        onOpenChange={setShowAddMethod}
        onAdded={(method) => {
          setPaymentMethods((prev) => [...prev, method])
          setSelectedMethodId(method.id)
          setShowAddMethod(false)
        }}
      />
    </>
  )
}
