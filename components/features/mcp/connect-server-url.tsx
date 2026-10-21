"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"

interface ConnectServerUrlProps {
  url: string
  className?: string
}

export function ConnectServerUrl({ url, className }: ConnectServerUrlProps) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-full bg-zinc-950 px-4 py-3",
        className,
      )}
    >
      <code className="min-w-0 truncate font-mono text-sm text-zinc-50">{url}</code>
      <button
        type="button"
        onClick={() => void copy()}
        className="shrink-0 text-xs font-medium text-zinc-300 hover:text-white"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  )
}
