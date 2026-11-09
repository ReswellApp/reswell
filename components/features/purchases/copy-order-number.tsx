"use client"

import { useState } from "react"
import { Check, Copy } from "lucide-react"

export function CopyOrderNumber({ orderNumber }: { orderNumber: string }) {
  const [copied, setCopied] = useState(false)

  return (
    <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
      {orderNumber}
      <button
        type="button"
        className="text-muted-foreground hover:text-foreground"
        aria-label={copied ? "Order number copied" : "Copy order number"}
        onClick={() => {
          void navigator.clipboard.writeText(orderNumber).then(
            () => {
              setCopied(true)
              window.setTimeout(() => setCopied(false), 1500)
            },
            () => setCopied(false),
          )
        }}
      >
        {copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
      </button>
    </span>
  )
}
