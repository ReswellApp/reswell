"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Share2, Check, Loader2 } from "lucide-react"
import { toast } from "sonner"

interface ShareButtonProps {
  title: string
}

export function ShareButton({ title }: ShareButtonProps) {
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
        toast.success("Link copied to clipboard")
        setTimeout(() => setJustCopied(false), 1500)
      } catch {
        toast.error("Could not copy link. You can copy it from the address bar.")
      } finally {
        setCopying(false)
      }
      return
    }

    toast.message("Share this listing", {
      description: url,
    })
  }

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={handleShare}
      aria-label="Share listing"
    >
      {copying ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : justCopied ? (
        <Check className="h-4 w-4" />
      ) : (
        <Share2 className="h-4 w-4" />
      )}
    </Button>
  )
}

