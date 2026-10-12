"use client"

import { useState } from "react"

export function useShopifyManualConnect() {
  const [shop, setShop] = useState("")
  const [clientId, setClientId] = useState("")
  const [clientSecret, setClientSecret] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setError(null)
    setBusy(true)
    try {
      const response = await fetch("/api/integrations/shopify/manual-connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shop, clientId, clientSecret }),
      })
      const json = (await response.json()) as { error?: string }
      if (!response.ok) {
        setError(json.error ?? "Could not connect your Shopify store.")
        setBusy(false)
        return
      }
      window.location.assign("/dashboard/shopify?connected=1")
    } catch {
      setError("Could not connect your Shopify store.")
      setBusy(false)
    }
  }

  return {
    shop,
    setShop,
    clientId,
    setClientId,
    clientSecret,
    setClientSecret,
    busy,
    error,
    submit,
  }
}
