"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { profileMediaDisplaySrc } from "@/lib/public-media-display-src"
import {
  threadsAccentTextClassName,
  threadsAvatarFallbackClassName,
} from "@/components/features/forum/threads-brand-styles"
import { cn } from "@/lib/utils"

type ThreadsProfilePageHeaderProps = {
  displayName: string
  email: string | null
  avatarUrl: string | null
  bio?: string | null
  className?: string
}

export function ThreadsProfilePageHeader({
  displayName,
  email,
  avatarUrl,
  bio,
  className,
}: ThreadsProfilePageHeaderProps) {
  const initial = displayName.charAt(0).toUpperCase()

  return (
    <header
      className={cn(
        "overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm",
        className,
      )}
    >
      <div className="h-2 bg-[#355185]" aria-hidden />
      <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:gap-5 sm:px-6">
        <Avatar className="h-16 w-16 shrink-0 border-2 border-background ring-2 ring-[#5574AD]/20">
          <AvatarImage src={profileMediaDisplaySrc(avatarUrl || "")} alt="" />
          <AvatarFallback className={cn("text-xl", threadsAvatarFallbackClassName)}>
            {initial}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#5574AD]">Threads profile</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">{displayName}</h1>
          {email ? <p className="mt-1 truncate text-sm text-muted-foreground">{email}</p> : null}
          {bio?.trim() ? (
            <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{bio.trim()}</p>
          ) : (
            <p className={cn("mt-2 text-sm", threadsAccentTextClassName)}>
              Update your display name, photo, and bio below.
            </p>
          )}
        </div>
      </div>
    </header>
  )
}
