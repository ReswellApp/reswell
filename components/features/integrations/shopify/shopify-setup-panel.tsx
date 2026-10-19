"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  shopifyBodyClass,
  shopifyDividerClass,
  shopifyPrimaryButtonClass,
  shopifySecondaryButtonClass,
  shopifySectionTitleClass,
  shopifySurfaceClass,
} from "@/components/features/integrations/shopify/shopify-admin-styles"
import type {
  PublicShopifyConnection,
  ShopifySourceOfTruth,
} from "@/lib/shopify/types"

interface ShopifySetupPanelProps {
  connection: PublicShopifyConnection
  onSourceChange: (source: ShopifySourceOfTruth) => void
}

export function ShopifySetupPanel({
  connection,
  onSourceChange,
}: ShopifySetupPanelProps) {
  const [source, setSource] = useState<ShopifySourceOfTruth>(connection.source_of_truth)
  const [saving, setSaving] = useState(false)
  const [approving, setApproving] = useState(false)
  const billingActive = connection.billing_status === "active"

  async function saveSource() {
    setSaving(true)
    try {
      const response = await fetch("/api/integrations/shopify/source", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceOfTruth: source }),
      })
      const body = (await response.json()) as { error?: string }
      if (!response.ok) {
        toast.error(body.error || "Could not save the source of truth")
        return
      }
      onSourceChange(source)
      toast.success("Source of truth saved")
    } catch {
      toast.error("Could not save the source of truth")
    } finally {
      setSaving(false)
    }
  }

  async function approveBilling() {
    setApproving(true)
    try {
      const response = await fetch("/api/integrations/shopify/billing", { method: "POST" })
      const body = (await response.json()) as {
        error?: string
        data?: { confirmationUrl: string | null }
      }
      if (!response.ok) {
        toast.error(body.error || "Could not open Shopify billing")
        setApproving(false)
        return
      }
      if (body.data?.confirmationUrl) {
        window.location.assign(body.data.confirmationUrl)
        return
      }
      window.location.assign("/dashboard/shopify?billing=approved")
    } catch {
      toast.error("Could not open Shopify billing")
      setApproving(false)
    }
  }

  return (
    <section className={shopifySurfaceClass}>
      <div className={`border-b px-5 py-4 ${shopifyDividerClass}`}>
        <h2 className={shopifySectionTitleClass}>Source of truth</h2>
        <p className={`mt-1 ${shopifyBodyClass}`}>
          This choice is saved on the Reswell connection and copied to the shop in Shopify.
          Changing it on either side updates both.
        </p>
      </div>
      <div className="space-y-3 px-5 py-4">
        <label className="flex items-start gap-2 text-[13px] leading-5">
          <input
            type="radio"
            name="shopify-source"
            className="mt-1"
            checked={source === "shopify"}
            onChange={() => setSource("shopify")}
          />
          <span>
            <span className="font-medium text-[#202223] dark:text-foreground">Shopify</span>
            <span className={`block ${shopifyBodyClass}`}>
              You choose which Shopify products publish on Reswell. Price, title, photos, and stock come from Shopify. A Reswell sale creates one paid Shopify order, and that order updates stock.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-2 text-[13px] leading-5">
          <input
            type="radio"
            name="shopify-source"
            className="mt-1"
            checked={source === "reswell"}
            onChange={() => setSource("reswell")}
          />
          <span>
            <span className="font-medium text-[#202223] dark:text-foreground">Reswell</span>
            <span className={`block ${shopifyBodyClass}`}>
              You choose which Reswell listings publish to Shopify. A Reswell sale removes that Shopify listing. Shopify edits do not change the Reswell listing.
            </span>
          </span>
        </label>
        <Button
          type="button"
          className={shopifyPrimaryButtonClass}
          disabled={saving || source === connection.source_of_truth}
          onClick={() => void saveSource()}
        >
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
          Save source of truth
        </Button>
      </div>
      <div className={`border-t px-5 py-4 ${shopifyDividerClass}`}>
        <h2 className={shopifySectionTitleClass}>7% usage charge</h2>
        <p className={`mt-1 ${shopifyBodyClass}`}>
          Connected sales are charged 7% once through Shopify Billing. That amount is not also taken from the Stripe payout. Sync stays off until you approve the charge. You can approve it later, including after a reinstall.
        </p>
        <div className="mt-3">
          {billingActive ? (
            <p className="text-[13px] font-medium text-[#014b40] dark:text-emerald-300">
              Usage charge approved. Sync can run.
            </p>
          ) : (
            <Button
              type="button"
              className={shopifySecondaryButtonClass}
              disabled={approving}
              onClick={() => void approveBilling()}
            >
              {approving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
              {connection.billing_status === "declined"
                ? "Approve the 7% charge"
                : "Approve the 7% charge"}
            </Button>
          )}
        </div>
      </div>
    </section>
  )
}
