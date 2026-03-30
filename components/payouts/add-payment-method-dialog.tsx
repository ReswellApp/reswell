"use client"

import { useState } from "react"
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Loader2, Landmark, CreditCard, Mail, AlertCircle } from "lucide-react"

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

interface AddPaymentMethodDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdded: (method: PaymentMethod) => void
}

export function AddPaymentMethodDialog({ open, onOpenChange, onAdded }: AddPaymentMethodDialogProps) {
  const [activeTab, setActiveTab] = useState("bank")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // Bank account fields
  const [bankName, setBankName] = useState("")
  const [accountNumber, setAccountNumber] = useState("")
  const [routingNumber, setRoutingNumber] = useState("")
  const [accountHolderName, setAccountHolderName] = useState("")

  // Debit card fields
  const [cardNumber, setCardNumber] = useState("")
  const [cardExpiry, setCardExpiry] = useState("")
  const [cardCvc, setCardCvc] = useState("")
  const [cardHolderName, setCardHolderName] = useState("")

  // PayPal
  const [paypalEmail, setPaypalEmail] = useState("")

  const resetForm = () => {
    setBankName(""); setAccountNumber(""); setRoutingNumber(""); setAccountHolderName("")
    setCardNumber(""); setCardExpiry(""); setCardCvc(""); setCardHolderName("")
    setPaypalEmail(""); setError("")
  }

  const handleClose = (v: boolean) => {
    if (!loading) { resetForm(); onOpenChange(v) }
  }

  const formatCardNumber = (v: string) =>
    v.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim()

  const formatExpiry = (v: string) => {
    const digits = v.replace(/\D/g, "").slice(0, 4)
    return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits
  }

  const handleSubmit = async () => {
    setError("")
    setLoading(true)

    try {
      let payload: Record<string, unknown> = {}

      if (activeTab === "bank") {
        if (!bankName || !accountNumber || !routingNumber) {
          setError("Please fill in all bank account fields")
          return
        }
        const accountDigits = accountNumber.replace(/\D/g, "")
        const routingDigits = routingNumber.replace(/\D/g, "")
        if (routingDigits.length !== 9) {
          setError("Routing number must be 9 digits")
          return
        }
        payload = {
          type: "BANK_ACCOUNT",
          bank_name: bankName,
          account_last4: accountDigits.slice(-4),
          routing_last4: routingDigits.slice(-4),
        }
      } else if (activeTab === "card") {
        const digits = cardNumber.replace(/\D/g, "")
        if (digits.length < 16 || !cardExpiry || !cardCvc) {
          setError("Please fill in all card fields")
          return
        }
        const [expMonth, expYear] = cardExpiry.split("/")
        payload = {
          type: "DEBIT_CARD",
          card_brand: detectCardBrand(digits),
          card_last4: digits.slice(-4),
          card_exp: `${expMonth?.padStart(2, "0")}/${expYear}`,
        }
      } else {
        if (!paypalEmail || !paypalEmail.includes("@")) {
          setError("Please enter a valid PayPal email")
          return
        }
        payload = {
          type: "PAYPAL",
          paypal_email: paypalEmail,
        }
      }

      const res = await fetch("/api/payouts/payment-methods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? "Failed to add payment method")
        return
      }

      resetForm()
      onAdded(data.method)
      onOpenChange(false)
    } catch {
      setError("An unexpected error occurred")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add payout method</DialogTitle>
          <DialogDescription>
            Add a bank account, debit card, or PayPal to receive payouts.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="bank" className="flex items-center gap-1.5 text-xs">
              <Landmark className="h-3.5 w-3.5" />
              Bank
            </TabsTrigger>
            <TabsTrigger value="card" className="flex items-center gap-1.5 text-xs">
              <CreditCard className="h-3.5 w-3.5" />
              Debit card
            </TabsTrigger>
            <TabsTrigger value="paypal" className="flex items-center gap-1.5 text-xs">
              <Mail className="h-3.5 w-3.5" />
              PayPal
            </TabsTrigger>
          </TabsList>

          {/* Bank account */}
          <TabsContent value="bank" className="space-y-4 pt-2">
            <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
              Verified bank accounts receive ACH transfers in 2–5 business days at no fee.
            </div>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="bank-name">Bank name</Label>
                <Input
                  id="bank-name"
                  placeholder="Chase, Wells Fargo, etc."
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="account-holder">Account holder name</Label>
                <Input
                  id="account-holder"
                  placeholder="Full legal name"
                  value={accountHolderName}
                  onChange={(e) => setAccountHolderName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="routing-number">Routing number</Label>
                <Input
                  id="routing-number"
                  placeholder="9 digits"
                  maxLength={9}
                  value={routingNumber}
                  onChange={(e) => setRoutingNumber(e.target.value.replace(/\D/g, ""))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="account-number">Account number</Label>
                <Input
                  id="account-number"
                  placeholder="Account number"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ""))}
                />
              </div>
            </div>
          </TabsContent>

          {/* Debit card */}
          <TabsContent value="card" className="space-y-4 pt-2">
            <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
              Visa and Mastercard debit cards only. Instant payouts available with a 1.5% fee.
            </div>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="card-holder">Cardholder name</Label>
                <Input
                  id="card-holder"
                  placeholder="Full name on card"
                  value={cardHolderName}
                  onChange={(e) => setCardHolderName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="card-number">Card number</Label>
                <Input
                  id="card-number"
                  placeholder="1234 5678 9012 3456"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                  maxLength={19}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="card-expiry">Expiry</Label>
                  <Input
                    id="card-expiry"
                    placeholder="MM/YY"
                    value={cardExpiry}
                    onChange={(e) => setCardExpiry(formatExpiry(e.target.value))}
                    maxLength={5}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="card-cvc">CVC</Label>
                  <Input
                    id="card-cvc"
                    placeholder="123"
                    maxLength={4}
                    value={cardCvc}
                    onChange={(e) => setCardCvc(e.target.value.replace(/\D/g, ""))}
                  />
                </div>
              </div>
            </div>
          </TabsContent>

          {/* PayPal */}
          <TabsContent value="paypal" className="space-y-4 pt-2">
            <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
              Payouts arrive in 1–3 business days at no fee to you.
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="paypal-email">PayPal email</Label>
              <Input
                id="paypal-email"
                type="email"
                placeholder="you@example.com"
                value={paypalEmail}
                onChange={(e) => setPaypalEmail(e.target.value)}
              />
            </div>
          </TabsContent>
        </Tabs>

        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            {loading ? "Saving..." : "Add method"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function detectCardBrand(digits: string): string {
  if (digits.startsWith("4")) return "Visa"
  if (/^5[1-5]/.test(digits) || /^2[2-7]/.test(digits)) return "Mastercard"
  if (/^3[47]/.test(digits)) return "Amex"
  if (/^6(?:011|5)/.test(digits)) return "Discover"
  return "Card"
}
