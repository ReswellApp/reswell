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
}

export function LiveChatSupportLeadAvatar({
  member,
  className,
  size = "md",
  imageAlt,
}: LiveChatSupportLeadAvatarProps) {
  const dimension = size === "sm" ? "h-8 w-8" : "h-9 w-9"
  const textSize = size === "sm" ? "text-[10px]" : "text-xs"

  if (member.imageUrl) {
    return (
      <span
        className={cn(
          "relative inline-flex shrink-0 overflow-hidden rounded-full border-2 border-background bg-muted",
          dimension,
          className,
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
    )
  }

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full border-2 border-background bg-sky-100 font-semibold text-sky-700",
        dimension,
        textSize,
        className,
      )}
    >
      {member.initials}
    </span>
  )
}
