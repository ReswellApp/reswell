"use client"

import { ExternalLink, MessageCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface CrmFacebookLinksProps {
  profileUrl: string | null
  threadUrl: string | null
  className?: string
  size?: "sm" | "default"
}

function safeFacebookHref(url: string | null): string | null {
  if (!url) return null
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== "https:") return null
    const host = parsed.hostname.toLowerCase()
    const allowed =
      host === "facebook.com" ||
      host.endsWith(".facebook.com") ||
      host === "messenger.com" ||
      host.endsWith(".messenger.com") ||
      host === "fb.com" ||
      host.endsWith(".fb.com")
    return allowed ? parsed.toString() : null
  } catch {
    return null
  }
}

export function CrmFacebookLinks({ profileUrl, threadUrl, className, size = "sm" }: CrmFacebookLinksProps) {
  const profile = safeFacebookHref(profileUrl)
  const thread = safeFacebookHref(threadUrl)
  if (!profile && !thread) return null

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)} onClick={(event) => event.stopPropagation()}>
      {thread ? (
        <Button asChild size={size} variant="default">
          <a href={thread} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="mr-1.5 h-3.5 w-3.5" />
            Open chat
          </a>
        </Button>
      ) : null}
      {profile ? (
        <Button asChild size={size} variant="outline">
          <a href={profile} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
            Profile
          </a>
        </Button>
      ) : null}
    </div>
  )
}
