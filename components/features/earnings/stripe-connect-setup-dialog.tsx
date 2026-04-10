"use client"

import { useEffect, useMemo, useState } from "react"
import { loadConnectAndInitialize } from "@stripe/connect-js"
import type { StripeConnectInstance } from "@stripe/connect-js"
import {
  ConnectAccountManagement,
  ConnectAccountOnboarding,
  ConnectComponentsProvider,
} from "@stripe/react-connect-js"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Loader2 } from "lucide-react"

export interface StripeConnectSetupDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** When payouts are already enabled, show account management (bank updates) instead of first-time onboarding. */
  useManagement: boolean
}

export function StripeConnectSetupDialog({
  open,
  onOpenChange,
  useManagement,
}: StripeConnectSetupDialogProps) {
  const [connectInstance, setConnectInstance] = useState<StripeConnectInstance | null>(null)
  const [initError, setInitError] = useState<string | null>(null)

  const origin = useMemo(() => {
    if (typeof window === "undefined") return ""
    return window.location.origin
  }, [])

  useEffect(() => {
    if (!open) {
      setConnectInstance(null)
      setInitError(null)
      return
    }

    const pk = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim()
    if (!pk) {
      setInitError("Stripe is not configured.")
      return
    }

    setInitError(null)

    try {
      const instance = loadConnectAndInitialize({
        publishableKey: pk,
        fetchClientSecret: async () => {
          const res = await fetch("/api/stripe/connect/account-session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          })
          const data = (await res.json()) as { clientSecret?: string; error?: string }
          if (!res.ok || !data.clientSecret) {
            throw new Error(data.error ?? "Could not open the secure session.")
          }
          return data.clientSecret
        },
        appearance: {
          overlays: "dialog",
          variables: {
            fontFamily:
              'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            fontSizeBase: "15px",
            borderRadius: "12px",
            spacingUnit: "10px",
            colorPrimary: "#18181b",
            colorBackground: "#ffffff",
            colorText: "#18181b",
            colorBorder: "#e4e4e7",
            formAccentColor: "#18181b",
          },
        },
      })
      setConnectInstance(instance)
    } catch (e) {
      console.error("[stripe connect dialog] init", e)
      setInitError("Could not load Stripe Connect. Try again.")
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-[calc(100vw-2rem)] p-0 gap-0 overflow-hidden sm:max-w-xl">
        <div className="px-6 pt-6 pb-2 border-b border-border/80 bg-muted/20">
          <DialogHeader className="space-y-1 text-left">
            <DialogTitle className="text-lg font-semibold tracking-tight">
              {useManagement ? "Payout account" : "Connect your bank"}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground leading-snug">
              {useManagement
                ? "Add or change payout banks and other account details in Stripe below. To remove a bank, link a second account first, set the default for payouts, then remove the old one."
                : "Add a US bank account for ACH payouts. Everything sensitive is handled by Stripe inside this window — we never store your bank details."}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="min-h-[28rem] max-h-[min(70vh,560px)] overflow-y-auto bg-background">
          {initError ? (
            <p className="p-6 text-sm text-destructive">{initError}</p>
          ) : !connectInstance ? (
            <div className="flex flex-col items-center justify-center gap-3 min-h-[28rem] text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin opacity-60" aria-hidden />
              <p className="text-sm">Preparing secure setup…</p>
            </div>
          ) : (
            <ConnectComponentsProvider connectInstance={connectInstance}>
              <div className="p-4 sm:p-5">
                {useManagement ? (
                  <ConnectAccountManagement />
                ) : (
                  <ConnectAccountOnboarding
                    onExit={() => onOpenChange(false)}
                    fullTermsOfServiceUrl={origin ? `${origin}/terms` : undefined}
                    privacyPolicyUrl={origin ? `${origin}/privacy` : undefined}
                  />
                )}
              </div>
            </ConnectComponentsProvider>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
