"use client"

import Link from "next/link"
import { useState } from "react"
import { Avatar, AvatarImage } from "@/components/ui/avatar"
import { ProfileCircleSlotFallback } from "@/components/profile-circle"

type SiteClosureAccountLinkProps = {
  name: string
  avatarUrl: string | null
}

export function SiteClosureAccountLink({ name, avatarUrl }: SiteClosureAccountLinkProps) {
  const [avatarFailed, setAvatarFailed] = useState(false)
  const photo = avatarUrl && !avatarFailed ? avatarUrl : null

  return (
    <Link
      href="/dashboard/profile"
      className="flex max-w-[12rem] items-center gap-2 text-sm text-foreground transition-colors hover:text-foreground/70"
      aria-label={`Profile, ${name}`}
    >
      <Avatar className="h-8 w-8 border border-border">
        {photo ? (
          <AvatarImage
            src={photo}
            alt=""
            onLoadingStatusChange={(status) => {
              if (status === "error") setAvatarFailed(true)
            }}
          />
        ) : null}
        <ProfileCircleSlotFallback hasPhoto={Boolean(photo)} />
      </Avatar>
      <span className="truncate">{name}</span>
    </Link>
  )
}
