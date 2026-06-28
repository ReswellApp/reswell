"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { SiteWordmarkLink } from "@/components/site-wordmark-link"
import { useAuthModal } from "@/components/auth/auth-modal-context"
import { profileMediaDisplaySrc } from "@/lib/public-media-display-src"
import { cn } from "@/lib/utils"

type BoardTalkChromeProps = {
  userId: string | null
  displayName: string | null
  avatarUrl: string | null
  className?: string
}

export function BoardTalkChrome({
  userId,
  displayName,
  avatarUrl,
  className,
}: BoardTalkChromeProps) {
  const authModal = useAuthModal()
  const name = displayName?.trim() || "Member"
  const initial = name.charAt(0).toUpperCase()

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b border-border/60 bg-background/90 backdrop-blur-md supports-[backdrop-filter]:bg-background/80",
        className,
      )}
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:h-16 sm:px-6">
        <SiteWordmarkLink href="/threads" className="-ml-2 px-1 sm:px-2" />
        <div className="flex items-center gap-2 sm:gap-3">
          {userId ? (
            <Link
              href="/dashboard"
              className="flex max-w-[12rem] items-center gap-2 rounded-full border border-border/70 bg-card px-2 py-1.5 pr-3 text-sm font-medium text-foreground transition-colors hover:bg-muted/60 sm:max-w-none"
            >
              <Avatar className="h-7 w-7">
                <AvatarImage src={profileMediaDisplaySrc(avatarUrl || "")} alt="" />
                <AvatarFallback className="text-xs">{initial}</AvatarFallback>
              </Avatar>
              <span className="truncate">{name}</span>
            </Link>
          ) : (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="min-h-touch rounded-full px-4"
                onClick={() => authModal.openLogin(null)}
              >
                Log in
              </Button>
              <Button
                type="button"
                size="sm"
                className="min-h-touch rounded-full px-4"
                onClick={() => authModal.openSignUp(null)}
              >
                Sign up
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
