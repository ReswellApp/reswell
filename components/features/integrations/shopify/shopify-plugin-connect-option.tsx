"use client"

import { useEffect, useState } from "react"
import { Check, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { shopifyPrimaryButtonClass } from "@/components/features/integrations/shopify/shopify-admin-styles"
import { ShopifyConnectOptionPanel } from "@/components/features/integrations/shopify/shopify-connect-option-panel"

interface ShopifyPluginConnectOptionProps {
  available: boolean
  installUrl: string | null
}

const STEPS = [
  "Approve the Reswell app on your Shopify store",
  "Approve the 7% usage charge",
  "Choose which products to publish",
]

export function ShopifyPluginConnectOption({
  available,
  installUrl,
}: ShopifyPluginConnectOptionProps) {
  const [redirecting, setRedirecting] = useState(false)

  useEffect(() => {
    const reset = () => setRedirecting(false)
    window.addEventListener("pageshow", reset)
    return () => window.removeEventListener("pageshow", reset)
  }, [])

  return (
    <ShopifyConnectOptionPanel
      title="Reswell Shopify app"
      badge="Recommended"
      description="Install the Reswell app on your store with one approval. No credentials to copy."
    >
      <ol className="mb-3 space-y-1.5">
        {STEPS.map((step) => (
          <li key={step} className="flex items-start gap-2 text-[13px] leading-5 text-[#202223] dark:text-foreground">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#303030] dark:text-foreground" aria-hidden />
            {step}
          </li>
        ))}
      </ol>

      {available && installUrl ? (
        <Button
          type="button"
          className={shopifyPrimaryButtonClass}
          disabled={redirecting}
          onClick={() => {
            setRedirecting(true)
            window.location.assign(installUrl)
          }}
        >
          {redirecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
          {redirecting ? "Opening Shopify…" : "Connect with Shopify"}
        </Button>
      ) : (
        <p className="rounded-lg border border-dashed border-[#c9cccf] px-3 py-3 text-[13px] leading-5 text-[#6d7175] dark:border-border dark:text-muted-foreground">
          The Reswell Shopify app is not available right now. Check back soon.
        </p>
      )}
    </ShopifyConnectOptionPanel>
  )
}
