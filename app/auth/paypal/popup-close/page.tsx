"use client"

import { useEffect, useState } from "react"

/**
 * Loaded in the OAuth popup after PayPal redirects. Notifies opener and closes,
 * or falls back to earnings if there is no opener (direct navigation).
 */
export default function PayPalPopupClosePage() {
  const [note, setNote] = useState("Finalizing…")

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const raw = params.get("status")
    const status = raw === "connected" ? "connected" : "error"

    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(
        { source: "reswell-paypal-oauth", status },
        window.location.origin,
      )
      setNote("Connected. You can close this window.")
      window.close()
      return
    }

    setNote("Redirecting…")
    window.location.replace(
      `/dashboard/earnings?paypal=${status === "connected" ? "connected" : "error"}`,
    )
  }, [])

  return (
    <div className="flex min-h-[200px] items-center justify-center p-6 text-sm text-muted-foreground">
      {note}
    </div>
  )
}
