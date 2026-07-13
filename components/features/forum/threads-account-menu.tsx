"use client"

import Link from "next/link"
import { useCallback } from "react"
import {
  ArrowLeft,
  Bell,
  ChevronDown,
  ChevronRight,
  Flame,
  LogOut,
  MessageSquare,
  PenSquare,
  Settings,
  Star,
  UserCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { signOutAndRedirect } from "@/lib/auth/sign-out-and-redirect"
import { profileMediaDisplaySrc } from "@/lib/public-media-display-src"
import { forceReleaseBodyScrollLock } from "@/hooks/use-body-scroll-lock"
import { threadsAvatarFallbackClassName } from "@/components/features/forum/threads-brand-styles"
import { cn } from "@/lib/utils"

type ThreadsAccountMenuProps = {
  displayName: string
  avatarUrl: string | null
  email?: string | null
  onNewTopic: () => void
  onPostReview: () => void
}

const THREADS_NAV = [
  { label: "Latest topics", href: "/threads", icon: MessageSquare },
  { label: "Top topics", href: "/threads?sort=top", icon: Flame },
  { label: "Board reviews", href: "/threads/reviews", icon: Star },
] as const

export function ThreadsAccountMenu({
  displayName,
  avatarUrl,
  email,
  onNewTopic,
  onPostReview,
}: ThreadsAccountMenuProps) {
  const initial = displayName.charAt(0).toUpperCase()

  const onOpenChange = useCallback((open: boolean) => {
    if (!open) forceReleaseBodyScrollLock()
  }, [])

  return (
    <DropdownMenu modal={false} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="flex h-auto max-w-[12rem] items-center gap-2 rounded-full border-border/70 bg-card px-2 py-1.5 pr-2.5 text-sm font-medium text-foreground shadow-sm hover:bg-muted/60 sm:max-w-none"
          aria-label="Threads profile menu"
        >
          <Avatar className="h-7 w-7">
            <AvatarImage src={profileMediaDisplaySrc(avatarUrl || "")} alt="" />
            <AvatarFallback className={cn("text-xs", threadsAvatarFallbackClassName)}>
              {initial}
            </AvatarFallback>
          </Avatar>
          <span className="truncate">{displayName}</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="z-[120] w-72 p-0">
        <div className="border-b border-border/60 bg-[#355185]/5 px-3 py-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-11 w-11 shrink-0 border border-border/70">
              <AvatarImage src={profileMediaDisplaySrc(avatarUrl || "")} alt="" />
              <AvatarFallback className={threadsAvatarFallbackClassName}>{initial}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{displayName}</p>
              {email ? (
                <p className="truncate text-xs text-muted-foreground">{email}</p>
              ) : null}
            </div>
          </div>
          <p className="mt-2.5">
            <span className="inline-flex rounded-full bg-[#5574AD]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#5574AD]">
              Threads profile
            </span>
          </p>
        </div>

        <div className="space-y-2 p-2">
          <Link
            href="/threads/profile"
            className="flex items-center gap-3 rounded-lg border border-border/60 bg-card px-3 py-3 transition-colors hover:bg-muted/40"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#5574AD]/10 text-[#5574AD]">
              <UserCircle className="h-5 w-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-foreground">Manage profile</span>
              <span className="block text-xs text-muted-foreground">
                Photo, display name, bio &amp; account
              </span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          </Link>

          <Link
            href="/threads/messages"
            className="flex items-center gap-3 rounded-lg border border-border/60 bg-card px-3 py-3 transition-colors hover:bg-muted/40"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#5574AD]/10 text-[#5574AD]">
              <Bell className="h-5 w-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-foreground">
                Messages &amp; activity
              </span>
              <span className="block text-xs text-muted-foreground">
                Replies and stokes from Threads
              </span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
        </div>

        <DropdownMenuSeparator className="my-0" />
        <div className="p-1">
          <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
            Participate
          </DropdownMenuLabel>
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault()
              onNewTopic()
            }}
          >
            <PenSquare className="mr-2 h-4 w-4" />
            New topic
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault()
              onPostReview()
            }}
          >
            <Star className="mr-2 h-4 w-4" />
            Post board review
          </DropdownMenuItem>
        </div>

        <DropdownMenuSeparator className="my-0" />
        <div className="p-1">
          <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
            Browse
          </DropdownMenuLabel>
          {THREADS_NAV.map((item) => {
            const Icon = item.icon
            return (
              <DropdownMenuItem key={item.href} asChild>
                <Link href={item.href} className="flex items-center">
                  <Icon className="mr-2 h-4 w-4" />
                  {item.label}
                </Link>
              </DropdownMenuItem>
            )
          })}
        </div>

        <DropdownMenuSeparator className="my-0" />
        <div className="p-1">
          <DropdownMenuItem asChild>
            <Link href="/threads/messages" className="flex items-center">
              <MessageSquare className="mr-2 h-4 w-4" />
              Messages
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/threads/profile" className="flex items-center">
              <Settings className="mr-2 h-4 w-4" />
              Profile settings
            </Link>
          </DropdownMenuItem>
        </div>

        <DropdownMenuSeparator className="my-0" />
        <div className="p-1">
          <DropdownMenuItem asChild>
            <Link href="/" className="flex items-center">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Reswell
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault()
              signOutAndRedirect("/threads")
            }}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
