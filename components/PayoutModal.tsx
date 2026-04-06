"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { ArrowLeft, Loader2, X } from "lucide-react"
import { getPaypalProfileStatus } from "@/app/actions/account"

type Step = "details" | "confirm" | "processing" | "success" | "error"

const PAYPAL_BLUE = "bg-[#0070ba] hover:bg-[#005ea6] text-white"
const PAYPAL_NAVY = "bg-[#003087] hover:bg-[#001f5c] text-white"

export interface PayoutModalProps {
  isOpen: boolean
  onClose: () => void
  availableBalance: number
  savedPaypalEmail?: string
  savedPaypalDisplayName?: string
  savedPaypalPayerId?: string
  onSuccess: (amount: number, paypalEmail: string) => void
  onPaypalConnectionChange?: () => void | Promise<void>
}

async function fetchPaypalStatus(): Promise<{
  paypal_email?: string | null
  paypal_display_name?: string | null
  paypal_payer_id?: string | null
}> {
  const res = await getPaypalProfileStatus()
  if (res.error) return {}
  return (res.data ?? {}) as {
    paypal_email?: string | null
    paypal_display_name?: string | null
    paypal_payer_id?: string | null
  }
}

function PayPalMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106zm14.146-14.42a3.35 3.35 0 0 0-.607-.541c-.013.076-.026.175-.041.254-.93 4.778-4.005 7.201-9.138 7.201h-2.19a.563.563 0 0 0-.556.479l-1.187 7.527h-.506l-.24 1.516a.56.56 0 0 0 .554.647h3.882c.46 0 .85-.334.922-.788.06-.26.76-4.852.816-5.09a.932.932 0 0 1 .923-.788h.58c3.76 0 6.705-1.528 7.565-5.946.36-1.847.174-3.388-.777-4.471z" />
    </svg>
  )
}

export default function PayoutModal({
  isOpen,
  onClose,
  availableBalance,
  savedPaypalEmail = "",
  savedPaypalDisplayName = "",
  savedPaypalPayerId = "",
  onSuccess,
  onPaypalConnectionChange,
}: PayoutModalProps) {
  const [step, setStep] = useState<Step>("details")
  const [amount, setAmount] = useState(availableBalance.toFixed(2))
  const [paypalEmail, setPaypalEmail] = useState(savedPaypalEmail)
  const [paypalName, setPaypalName] = useState(savedPaypalDisplayName)
  const [paypalConnected, setPaypalConnected] = useState(
    Boolean(savedPaypalPayerId || savedPaypalEmail),
  )
  const [connectingPayPal, setConnectingPayPal] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")

  const wasOpen = useRef(false)
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  const applyStatus = useCallback(
    (d: {
      paypal_email?: string | null
      paypal_display_name?: string | null
      paypal_payer_id?: string | null
    }) => {
      const em = d.paypal_email?.trim() ?? ""
      const id = d.paypal_payer_id?.trim() ?? ""
      const nm = d.paypal_display_name?.trim() ?? ""
      setPaypalEmail(em)
      setPaypalName(nm)
      setPaypalConnected(Boolean(id || em))
    },
    [],
  )

  useEffect(() => {
    if (isOpen && !wasOpen.current) {
      setStep("details")
      setErrorMessage("")
      setAmount(availableBalance.toFixed(2))
      applyStatus({
        paypal_email: savedPaypalEmail,
        paypal_display_name: savedPaypalDisplayName,
        paypal_payer_id: savedPaypalPayerId,
      })
    }
    wasOpen.current = isOpen
  }, [
    isOpen,
    availableBalance,
    savedPaypalEmail,
    savedPaypalDisplayName,
    savedPaypalPayerId,
    applyStatus,
  ])

  useEffect(() => {
    return () => {
      if (pollTimer.current) {
        clearInterval(pollTimer.current)
        pollTimer.current = null
      }
    }
  }, [])

  useEffect(() => {
    function onMsg(e: MessageEvent) {
      if (e.origin !== window.location.origin) return
      const data = e.data as { source?: string; status?: string }
      if (data?.source !== "reswell-paypal-oauth") return
      setConnectingPayPal(false)
      if (pollTimer.current) {
        clearInterval(pollTimer.current)
        pollTimer.current = null
      }
      void (async () => {
        const s = await fetchPaypalStatus()
        applyStatus(s)
        void onPaypalConnectionChange?.()
      })()
    }
    window.addEventListener("message", onMsg)
    return () => window.removeEventListener("message", onMsg)
  }, [applyStatus, onPaypalConnectionChange])

  const connectPayPal = async () => {
    setConnectingPayPal(true)
    setErrorMessage("")
    try {
      const res = await fetch("/api/auth/paypal/connect")
      if (!res.ok) {
        setConnectingPayPal(false)
        setErrorMessage("Could not start PayPal login. Try again.")
        return
      }
      const { url } = (await res.json()) as { url?: string }
      if (!url) {
        setConnectingPayPal(false)
        return
      }
      const popup = window.open(
        url,
        "paypal_oauth",
        "width=520,height=700,scrollbars=yes,resizable=yes",
      )
      if (!popup) {
        setConnectingPayPal(false)
        setErrorMessage("Pop-up was blocked. Allow pop-ups for this site.")
        return
      }

      if (pollTimer.current) clearInterval(pollTimer.current)
      pollTimer.current = setInterval(async () => {
        if (popup.closed) {
          if (pollTimer.current) {
            clearInterval(pollTimer.current)
            pollTimer.current = null
          }
          setConnectingPayPal(false)
          const s = await fetchPaypalStatus()
          applyStatus(s)
          void onPaypalConnectionChange?.()
        }
      }, 400)
    } catch {
      setConnectingPayPal(false)
      setErrorMessage("Network error. Try again.")
    }
  }

  const disconnectPayPal = async () => {
    try {
      const res = await fetch("/api/auth/paypal/disconnect", { method: "POST" })
      if (!res.ok) return
      setPaypalConnected(false)
      setPaypalEmail("")
      setPaypalName("")
      void onPaypalConnectionChange?.()
    } catch {
      /* ignore */
    }
  }

  const displayRecipient =
    paypalName || paypalEmail || "your PayPal account"

  const parsedAmount = parseFloat(amount)
  const isValidAmount =
    Number.isFinite(parsedAmount) &&
    parsedAmount >= 10 &&
    parsedAmount <= availableBalance + 0.005

  const handleSubmit = async () => {
    setStep("processing")
    try {
      const res = await fetch("/api/payouts/paypal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parsedAmount,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setStep("success")
        onSuccess(parsedAmount, paypalEmail.trim())
      } else {
        setErrorMessage(
          typeof data.error === "string" ? data.error : "Something went wrong.",
        )
        setStep("error")
      }
    } catch {
      setErrorMessage("Network error. Please try again.")
      setStep("error")
    }
  }

  const handleClose = () => {
    setStep("details")
    setErrorMessage("")
    if (pollTimer.current) {
      clearInterval(pollTimer.current)
      pollTimer.current = null
    }
    onClose()
  }

  const canDismiss = step !== "processing"

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && canDismiss) handleClose()
      }}
    >
      <DialogContent
        showCloseButton={false}
        className={cn(
          "max-w-[440px] gap-0 overflow-hidden rounded-2xl p-0 sm:rounded-2xl",
          "border border-border/60 shadow-2xl",
        )}
      >
        <div className="max-h-[85vh] overflow-y-auto">
          {step === "details" && (
            <div className="p-7 pt-8">
              <div className="flex items-start justify-between gap-3 mb-6">
                <DialogHeader className="space-y-1 text-left p-0">
                  <DialogTitle className="text-lg font-semibold">
                    Cash out via PayPal
                  </DialogTitle>
                  <DialogDescription className="text-sm">
                    Available: ${availableBalance.toFixed(2)}
                  </DialogDescription>
                </DialogHeader>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0 -mr-1 text-muted-foreground hover:text-foreground"
                  onClick={handleClose}
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="payout-modal-amount">Amount</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg font-semibold text-muted-foreground">
                      $
                    </span>
                    <Input
                      id="payout-modal-amount"
                      type="number"
                      inputMode="decimal"
                      min={10}
                      max={availableBalance}
                      step="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="h-12 pl-8 text-xl font-semibold tabular-nums rounded-xl"
                    />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Min $10.00</span>
                    <button
                      type="button"
                      className="text-[#0070ba] font-medium hover:underline"
                      onClick={() => setAmount(availableBalance.toFixed(2))}
                    >
                      Use max
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>PayPal account</Label>
                  {paypalConnected ? (
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-700/40 bg-emerald-50/80 dark:bg-emerald-950/30 px-3.5 py-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-emerald-700 dark:text-emerald-400 text-lg shrink-0" aria-hidden>
                          ✓
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-emerald-900 dark:text-emerald-200 truncate">
                            {displayRecipient}
                          </p>
                          {paypalEmail ? (
                            <p className="text-xs text-emerald-800/80 dark:text-emerald-400/90 truncate">
                              {paypalEmail}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="text-[11px] font-medium text-emerald-800 dark:text-emerald-400 underline shrink-0"
                        onClick={disconnectPayPal}
                      >
                        Disconnect
                      </button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      disabled={connectingPayPal}
                      className={cn(
                        "w-full h-12 rounded-xl text-[15px] font-medium gap-2.5",
                        connectingPayPal
                          ? "bg-muted text-muted-foreground"
                          : PAYPAL_NAVY,
                      )}
                      onClick={connectPayPal}
                    >
                      {connectingPayPal ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Connecting to PayPal…
                        </>
                      ) : (
                        <>
                          <PayPalMark className="text-white" />
                          Log in with PayPal
                        </>
                      )}
                    </Button>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Verify your PayPal account with a secure login — no typing email addresses.
                  </p>
                  {errorMessage ? (
                    <p className="text-sm text-destructive">{errorMessage}</p>
                  ) : null}
                </div>
              </div>

              <Button
                type="button"
                className={cn(
                  "w-full h-12 mt-6 rounded-xl text-[15px] font-medium",
                  paypalConnected && isValidAmount
                    ? PAYPAL_BLUE
                    : "bg-muted text-muted-foreground pointer-events-none",
                )}
                disabled={!paypalConnected || !isValidAmount}
                onClick={() => setStep("confirm")}
              >
                Continue →
              </Button>
            </div>
          )}

          {step === "confirm" && (
            <div className="p-7 pt-8">
              <button
                type="button"
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-5"
                onClick={() => setStep("details")}
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </button>

              <DialogHeader className="text-left p-0 space-y-1 mb-5">
                <DialogTitle className="text-lg font-semibold">
                  Confirm your payout
                </DialogTitle>
                <DialogDescription className="sr-only">
                  Review amount and PayPal destination before sending.
                </DialogDescription>
              </DialogHeader>

              <div className="rounded-xl bg-muted/50 border border-border/50 p-4 space-y-0 mb-5">
                {(
                  [
                    { label: "Sending to", value: displayRecipient },
                    ...(paypalEmail
                      ? [{ label: "PayPal email", value: paypalEmail }]
                      : []),
                    { label: "Amount", value: `$${parsedAmount.toFixed(2)}` },
                    { label: "Fee", value: "Free" },
                    {
                      label: "You receive",
                      value: `$${parsedAmount.toFixed(2)}`,
                      bold: true,
                    },
                    { label: "Arrival", value: "1–3 business days" },
                  ] as { label: string; value: string; bold?: boolean }[]
                ).map((row, i, arr) => (
                  <div
                    key={`${row.label}-${i}`}
                    className={cn(
                      "flex justify-between gap-3 py-2.5 text-sm",
                      i < arr.length - 1 && "border-b border-border/40",
                    )}
                  >
                    <span className="text-muted-foreground shrink-0">{row.label}</span>
                    <span
                      className={cn(
                        "text-right font-medium break-all",
                        row.bold && "font-semibold text-foreground",
                      )}
                    >
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>

              <Button
                type="button"
                className={cn("w-full h-12 rounded-xl text-[15px] font-medium mb-3", PAYPAL_BLUE)}
                onClick={handleSubmit}
              >
                Confirm — send ${parsedAmount.toFixed(2)} via PayPal
              </Button>
              <p className="text-[11px] text-center text-muted-foreground leading-relaxed">
                By confirming you agree this payout cannot be reversed once sent.
              </p>
            </div>
          )}

          {step === "processing" && (
            <div className="px-7 py-14 text-center">
              <div
                className="mx-auto mb-6 h-14 w-14 rounded-full border-[3px] border-muted border-t-[#0070ba] animate-spin"
                aria-hidden
              />
              <DialogTitle className="text-lg font-semibold mb-2">
                Sending to PayPal…
              </DialogTitle>
              <p className="text-sm text-muted-foreground animate-pulse">
                Please don&apos;t close this window
              </p>

              <div className="mt-8 flex flex-col gap-2.5 text-left">
                {[
                  "Verifying your balance",
                  "Submitting to PayPal",
                  "Confirming transaction",
                ].map((label, i) => (
                  <div
                    key={label}
                    className={cn(
                      "flex items-center gap-3 rounded-lg bg-muted/50 px-3.5 py-2.5 text-sm text-muted-foreground",
                      "border border-border/40",
                    )}
                    style={{ animationDelay: `${i * 150}ms` }}
                  >
                    <span className="h-2 w-2 shrink-0 rounded-full bg-[#0070ba] animate-pulse" />
                    {label}
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === "success" && (
            <div className="px-7 py-12 text-center">
              <div
                className={cn(
                  "mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full",
                  "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400",
                  "text-2xl font-semibold",
                )}
              >
                ✓
              </div>
              <DialogTitle className="text-xl font-semibold text-emerald-700 dark:text-emerald-400 mb-2">
                Payout sent!
              </DialogTitle>
              <p className="text-sm text-muted-foreground mb-1">
                ${parsedAmount.toFixed(2)} is on its way to {displayRecipient}
              </p>
              <p className="text-xs text-muted-foreground mb-8">
                Typically arrives within 1–3 business days
              </p>

              <div className="mb-6 rounded-xl bg-muted/50 border border-border/50 p-4 text-left text-sm space-y-2">
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Amount sent</span>
                  <span className="font-semibold tabular-nums">
                    ${parsedAmount.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground shrink-0">To</span>
                  <span className="font-medium text-right break-all">
                    {paypalEmail || displayRecipient}
                  </span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full h-11 rounded-xl font-medium"
                onClick={handleClose}
              >
                Done
              </Button>
            </div>
          )}

          {step === "error" && (
            <div className="px-7 py-12 text-center">
              <div
                className={cn(
                  "mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full",
                  "bg-destructive/15 text-destructive text-2xl font-light",
                )}
                aria-hidden
              >
                ×
              </div>
              <DialogTitle className="text-xl font-semibold text-destructive mb-2">
                Payout failed
              </DialogTitle>
              <p className="text-sm text-muted-foreground mb-8 leading-relaxed">
                {errorMessage}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  className={cn("flex-1 h-11 rounded-xl font-medium", PAYPAL_BLUE)}
                  onClick={() => {
                    setErrorMessage("")
                    setStep("details")
                  }}
                >
                  Try again
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 h-11 rounded-xl font-medium"
                  onClick={handleClose}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
