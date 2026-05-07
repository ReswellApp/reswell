"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Share2, Check, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

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
        <Share2 className={cn("h-4 w-4", iconClassName)} />
      )}
    </Button>
  )
}

