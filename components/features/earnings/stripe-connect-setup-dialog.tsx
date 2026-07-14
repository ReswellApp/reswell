"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  loadConnectAndInitialize,
  type StripeConnectInstance,
} from "@stripe/connect-js/pure"
import {
  ConnectAccountManagement,
  ConnectAccountOnboarding,
  ConnectComponentsProvider,
} from "@stripe/react-connect-js"
import type { CollectionOptions } from "@stripe/connect-js"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import type { StripeConnectStatusPayload } from "@/lib/utils/stripe-connect-status"
import { PayoutRequirementsChecklist } from "@/components/features/earnings/payout-requirements-checklist"
import Link from "next/link"

export interface StripeConnectSetupDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  connectStatus: StripeConnectStatusPayload | null
  /** When cash-out is ready, open bank management instead of onboarding. */
  preferManagement?: boolean
}

type SetupMode = "first_time" | "verification" | "manage" | "pending_review" | "restricted"

function resolveSetupMode(
  connectStatus: StripeConnectStatusPayload | null,
  preferManagement: boolean,
): SetupMode {
  if (connectStatus?.setupStatus === "pending_review") return "pending_review"
  if (connectStatus?.setupStatus === "restricted") return "restricted"
  if (connectStatus?.cashOutReady && preferManagement) return "manage"
  if (connectStatus?.setupStatus === "action_required" && connectStatus.bankLinked) {
    return "verification"
  }
  if (!connectStatus?.hasAccount || !connectStatus.bankLinked) return "first_time"
  if (connectStatus.cashOutReady) return "manage"
  return "first_time"
}

function setupCopy(mode: SetupMode, connectStatus: StripeConnectStatusPayload | null) {
  const checklist = connectStatus?.requirementsChecklist ?? []
  const detail = connectStatus?.verificationMessage

  if (mode === "pending_review") {
    return {
      title: "Stripe is reviewing your details",
      description:
        detail ??
        "You have submitted your information. Stripe is verifying it now — this usually takes a few minutes. Use Refresh on the Earnings page; you do not need to enter the same details again.",
    }
  }

  if (mode === "restricted") {
    return {
      title: "Payouts paused by Stripe",
      description:
        detail ??
        "Stripe has paused payouts on this account and there is nothing left to submit in the form. Contact Reswell support if this continues.",
    }
  }

  if (mode === "manage") {
    return {
      title: "Payout account",
      description:
        "Add or change payout banks in Stripe below. To remove a bank, link a second account first, set it as default, then remove the old one.",
    }
  }

  if (mode === "verification") {
    return {
      title: "Finish payout verification",
      description:
        detail ??
        "Complete the missing details below in Stripe. Use the legal name on your ID. Stay on this page until the form finishes.",
    }
  }

  return {
    title: "Set up bank payouts",
    description:
      checklist.length > 0
        ? "Stripe will walk you through each item below. Reswell never stores your bank or identity details."
        : "Add a US bank account for ACH payouts. Everything sensitive is handled by Stripe in this window.",
  }
}

export function StripeConnectSetupDialog({
  open,
  onOpenChange,
  connectStatus,
  preferManagement = false,
}: StripeConnectSetupDialogProps) {
  const [connectInstance, setConnectInstance] = useState<StripeConnectInstance | null>(null)
  const [initError, setInitError] = useState<string | null>(null)
  const [stripeFormLoading, setStripeFormLoading] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)
  const sawOnboardingStepRef = useRef(false)

  const mode = resolveSetupMode(connectStatus, preferManagement)
  const checklist = connectStatus?.requirementsChecklist ?? []
  const copy = setupCopy(mode, connectStatus)

  const collectionOptions = useMemo<CollectionOptions>(() => {
    const fromStatus = connectStatus?.collectionOptions
    // Verification with bank already linked almost always needs eventually_due (DOB/SSN).
    const fields =
      mode === "verification"
        ? "eventually_due"
        : (fromStatus?.fields ?? "eventually_due")
    return {
      fields,
      futureRequirements: fromStatus?.futureRequirements ?? "include",
    }
  }, [connectStatus?.collectionOptions, mode])

  const origin = useMemo(() => {
    if (typeof window === "undefined") return ""
    return window.location.origin
  }, [])

  const useEmbedded = mode === "first_time" || mode === "verification" || mode === "manage"
  const showOnboarding = mode === "first_time" || mode === "verification"
  const showManagement = mode === "manage"

  useEffect(() => {
    if (!open) {
      setConnectInstance(null)
      setInitError(null)
      setStripeFormLoading(false)
      sawOnboardingStepRef.current = false
      return
    }

    if (!useEmbedded) return

    const pk = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim()
    if (!pk) {
      setInitError("Stripe is not configured.")
      return
    }

    setInitError(null)
    setStripeFormLoading(true)
    sawOnboardingStepRef.current = false

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
          // Keep Stripe UI inline inside our Dialog — nested Stripe dialogs hang/close.
          overlays: "never",
          variables: {
            fontFamily:
              'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
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
      setStripeFormLoading(false)
    }
  }, [open, useEmbedded, reloadToken])

  useEffect(() => {
    if (!open || !connectInstance || !useEmbedded) return
    const timer = window.setTimeout(() => setStripeFormLoading(false), 12_000)
    return () => window.clearTimeout(timer)
  }, [open, connectInstance, useEmbedded, reloadToken])

  const handleOnboardingExit = useCallback(() => {
    if (sawOnboardingStepRef.current) {
      onOpenChange(false)
      return
    }
    // Stripe sometimes exits immediately when collection options are wrong / session stale.
    setInitError(
      "Stripe closed before the form loaded. Tap Try again — we will reload the secure form.",
    )
    setStripeFormLoading(false)
  }, [onOpenChange])

  const retryEmbedded = useCallback(() => {
    setInitError(null)
    setConnectInstance(null)
    setReloadToken((n) => n + 1)
  }, [])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-[calc(100vw-2rem)] p-0 gap-0 overflow-hidden sm:max-w-xl">
        <div className="px-6 pt-6 pb-2 border-b border-border/80 bg-muted/20">
          <DialogHeader className="space-y-1 text-left">
            <DialogTitle className="text-lg font-semibold tracking-tight">{copy.title}</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground leading-snug">
              {copy.description}
            </DialogDescription>
          </DialogHeader>
          {checklist.length > 0 ? (
            <div className="mt-4">
              <PayoutRequirementsChecklist items={checklist} title="Complete these in Stripe" />
            </div>
          ) : null}
        </div>

        <div className="min-h-[12rem] max-h-[min(70vh,560px)] overflow-y-auto bg-background">
          {mode === "pending_review" || mode === "restricted" ? (
            <div className="p-6 space-y-3">
              <Button type="button" className="w-full rounded-full" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              {mode === "restricted" ? (
                <Button type="button" variant="outline" className="w-full rounded-full" asChild>
                  <Link href="/contact">Contact support</Link>
                </Button>
              ) : null}
            </div>
          ) : initError ? (
            <div className="p-6 space-y-3">
              <p className="text-sm text-destructive">{initError}</p>
              <Button type="button" className="w-full rounded-full" onClick={retryEmbedded}>
                Try again
              </Button>
            </div>
          ) : !connectInstance ? (
            <div className="flex flex-col items-center justify-center gap-3 min-h-[16rem] text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin opacity-60" aria-hidden />
              <p className="text-sm">Preparing secure setup…</p>
            </div>
          ) : (
            <ConnectComponentsProvider connectInstance={connectInstance}>
              <div className="relative p-4 sm:p-5 min-h-[16rem]">
                {stripeFormLoading ? (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background/90">
                    <Loader2 className="h-8 w-8 animate-spin opacity-60" aria-hidden />
                    <p className="text-sm text-muted-foreground">Loading Stripe form…</p>
                  </div>
                ) : null}
                {showOnboarding ? (
                  <ConnectAccountOnboarding
                    collectionOptions={collectionOptions}
                    onExit={handleOnboardingExit}
                    onStepChange={() => {
                      sawOnboardingStepRef.current = true
                      setStripeFormLoading(false)
                    }}
                    onLoaderStart={() => setStripeFormLoading(true)}
                    onLoadError={(event) => {
                      console.error("[stripe connect dialog] onboarding load error", event.error)
                      setInitError(
                        event.error?.message ??
                          "Stripe could not load the verification form. Try again.",
                      )
                      setStripeFormLoading(false)
                    }}
                    fullTermsOfServiceUrl={origin ? `${origin}/terms` : undefined}
                    privacyPolicyUrl={origin ? `${origin}/privacy` : undefined}
                  />
                ) : showManagement ? (
                  <ConnectAccountManagement
                    collectionOptions={collectionOptions}
                    onLoaderStart={() => setStripeFormLoading(true)}
                    onLoadError={(event) => {
                      console.error("[stripe connect dialog] management load error", event.error)
                      setInitError(
                        event.error?.message ?? "Stripe could not load bank settings. Try again.",
                      )
                      setStripeFormLoading(false)
                    }}
                  />
                ) : null}
              </div>
            </ConnectComponentsProvider>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
