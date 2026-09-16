"use client"

import Image from "next/image"
import { listingImageShouldBypassOptimization } from "@/lib/listing-media-proxy-url"
import type { LiveChatSupportTeamMember } from "@/lib/services/liveChatSupportTeamDisplay"
import { cn } from "@/lib/utils"

interface LiveChatSupportLeadAvatarProps {
  member: LiveChatSupportTeamMember
  className?: string
  size?: "sm" | "md"
  imageAlt?: string
  status?: "online" | "away" | "typing" | null
}

export function LiveChatSupportLeadAvatar({
  member,
  className,
  size = "md",
  imageAlt,
  status = null,
}: LiveChatSupportLeadAvatarProps) {
  const dimension = size === "sm" ? "h-8 w-8" : "h-9 w-9"
  const textSize = size === "sm" ? "text-[10px]" : "text-xs"
  const statusClass =
    status === "online" || status === "typing"
      ? "bg-emerald-500"
      : status === "away"
        ? "bg-amber-400"
        : null

  const face = member.imageUrl ? (
    <span
      className={cn(
        "relative inline-flex shrink-0 overflow-hidden rounded-full border-2 border-background bg-muted",
        dimension,
      )}
    >
      <Image
        src={member.imageUrl}
        alt={imageAlt ?? member.name}
        fill
        className="object-cover"
        sizes={size === "sm" ? "32px" : "36px"}
        unoptimized={listingImageShouldBypassOptimization(member.imageUrl)}
      />
    </span>
  ) : (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full border-2 border-background bg-sky-100 font-semibold text-sky-700",
        dimension,
        textSize,
      )}
    >
      {member.initials}
    </span>
  )

  if (!statusClass) {
    return <span className={cn("relative inline-flex shrink-0", className)}>{face}</span>
  }

  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      {face}
      <span
        className={cn(
          "absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-background",
          statusClass,
        )}
        aria-hidden
      />
    </span>
  )
}
