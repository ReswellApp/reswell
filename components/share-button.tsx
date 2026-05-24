"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Check, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

function ShareIosIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M12 4v9.5" />
      <path d="M8.5 8.5 12 5l3.5 3.5" />
      <path d="M5 15.5v3A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5v-3" />
    </svg>
  )
}

interface ShareButtonProps {
  title: string
  className?: string
  iconClassName?: string
}

export function ShareButton({ title, className, iconClassName }: ShareButtonProps) {
  const [copying, setCopying] = useState(false)
  const [justCopied, setJustCopied] = useState(false)

  async function handleShare() {
    const url = window.location.href

    if (navigator.share) {
      try {
        await navigator.share({ title, url })
      } catch {
        // user cancelled or share failed – silently ignore
      }
      return
    }

    if (navigator.clipboard?.writeText) {
      try {
        setCopying(true)
        await navigator.clipboard.writeText(url)
        setJustCopied(true)
        setTimeout(() => setJustCopied(false), 1500)
      } catch {
        toast.error("Could not copy link. You can copy it from the address bar.")
      } finally {
        setCopying(false)
      }
      return
    }

    toast("Copy this link from the address bar.", { duration: 4000 })
  }

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={handleShare}
      aria-label={justCopied ? "Link copied" : copying ? "Copying link" : "Share listing"}
      className={cn(className)}
    >
      {copying ? (
        <Loader2 className={cn("h-4 w-4 animate-spin", iconClassName)} />
      ) : justCopied ? (
        <Check className={cn("h-4 w-4", iconClassName)} />
      ) : (
        <ShareIosIcon className={cn("h-4 w-4", iconClassName)} />
      )}
    </Button>
  )
}

