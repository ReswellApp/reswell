"use client"

import Link from "next/link"
import { memo, useCallback } from "react"
import type { User as SupabaseUser } from "@supabase/supabase-js"
import { LogOut, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { DASHBOARD_NAV_LINKS } from "@/lib/dashboard-nav-links"
import { forceReleaseBodyScrollLock } from "@/hooks/use-body-scroll-lock"

export type HeaderAccountMenuProps = {
  user: SupabaseUser
  profileAvatarUrl: string | null
  avatarImageFailed: boolean
  onAvatarImageFailed: () => void
  resolvedInitial: string
  resolvedDisplayName: string
  walletBalance: number | null
  isAdmin: boolean
  onSignOut: () => void
}

function HeaderAccountMenuInner({
  user,
  profileAvatarUrl,
  avatarImageFailed,
  onAvatarImageFailed,
  resolvedInitial,
  resolvedDisplayName,
  walletBalance,
  isAdmin,
  onSignOut,
}: HeaderAccountMenuProps) {
  const onOpenChange = useCallback((open: boolean) => {
    if (!open) forceReleaseBodyScrollLock()
  }, [])

  return (
    <DropdownMenu modal={false} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-foreground md:h-10 md:w-10">
          <Avatar className="h-7 w-7 md:h-9 md:w-9">
            {profileAvatarUrl && !avatarImageFailed ? (
              <AvatarImage
                src={profileAvatarUrl}
                alt="Profile"
                onLoadingStatusChange={(status) => {
                  if (status === "error") onAvatarImageFailed()
                }}
              />
            ) : null}
            <AvatarFallback className="text-foreground">{resolvedInitial}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="z-[120] w-56">
        <div className="flex items-center gap-3 px-2 py-2">
          <Avatar className="h-10 w-10 shrink-0 border border-border">
            {profileAvatarUrl && !avatarImageFailed ? (
              <AvatarImage
                src={profileAvatarUrl}
                alt=""
                onLoadingStatusChange={(status) => {
                  if (status === "error") onAvatarImageFailed()
                }}
              />
            ) : null}
            <AvatarFallback className="text-sm text-foreground">{resolvedInitial}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{resolvedDisplayName}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </div>
        </div>
        <DropdownMenuSeparator />
        {DASHBOARD_NAV_LINKS.map((link) => {
          const Icon = link.icon
          if (link.href === "/dashboard/earnings") {
            return (
              <DropdownMenuItem key={link.href} asChild>
                <Link href={link.href} className="flex items-center justify-between">
                  <span className="flex items-center">
                    <Icon className="mr-2 h-4 w-4" />
                    {link.name}
                  </span>
                  {walletBalance !== null && (
                    <span className="ml-2 text-xs font-medium tabular-nums text-foreground dark:text-white">
                      ${walletBalance.toFixed(2)}
                    </span>
                  )}
                </Link>
              </DropdownMenuItem>
            )
          }
          return (
            <DropdownMenuItem key={link.href} asChild>
              <Link href={link.href} className="flex items-center">
                <Icon className="mr-2 h-4 w-4" />
                {link.name}
              </Link>
            </DropdownMenuItem>
          )
        })}
        {isAdmin ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/admin/home" className="flex items-center text-foreground">
                <User className="mr-2 h-4 w-4" />
                Admin Panel
              </Link>
            </DropdownMenuItem>
          </>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault()
            void onSignOut()
          }}
          className="text-foreground"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export const HeaderAccountMenu = memo(HeaderAccountMenuInner)
