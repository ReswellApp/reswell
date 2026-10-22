"use client"

import Link from "next/link"
import { memo, useCallback, useRef, useState } from "react"
import type { User as SupabaseUser } from "@supabase/supabase-js"
import { ChevronRight, LogOut, User } from "lucide-react"
import { AccountSwitchDialog } from "@/components/features/dashboard/account-switcher"
import type { HeaderShopAccess } from "@/lib/auth/header-site-bootstrap"
import { headerInitialFromDisplayName } from "@/lib/header-user-display"
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
import { dashboardNavSections } from "@/lib/dashboard-nav-links"
import { forceReleaseBodyScrollLock } from "@/hooks/use-body-scroll-lock"
import { NavUnreadCountBadge } from "@/components/nav-unread-count-badge"

export type HeaderAccountMenuProps = {
  user: SupabaseUser
  profileAvatarUrl: string | null
  avatarImageFailed: boolean
  onAvatarImageFailed: () => void
  resolvedInitial: string
  resolvedDisplayName: string
  walletBalance: number | null
  unreadSupport: number
  isAdmin: boolean
  isShipper: boolean
  isDropoffLocation: boolean
  shopAccess: HeaderShopAccess | null
  onActiveAccountChange?: (accountId: string | null) => void
  onSignOut: () => void
}

function ProfileAvatar({
  profileAvatarUrl,
  avatarImageFailed,
  onAvatarImageFailed,
  initial,
  imageAlt,
}: {
  profileAvatarUrl: string | null
  avatarImageFailed: boolean
  onAvatarImageFailed: () => void
  initial: string
  imageAlt: string
}) {
  return (
    <Avatar className="h-10 w-10 shrink-0 border border-border">
      {profileAvatarUrl && !avatarImageFailed ? (
        <AvatarImage
          src={profileAvatarUrl}
          alt={imageAlt}
          onLoadingStatusChange={(status) => {
            if (status === "error") onAvatarImageFailed()
          }}
        />
      ) : null}
      <AvatarFallback className="text-sm text-foreground">{initial}</AvatarFallback>
    </Avatar>
  )
}

function HeaderAccountMenuInner({
  user,
  profileAvatarUrl,
  avatarImageFailed,
  onAvatarImageFailed,
  resolvedInitial,
  resolvedDisplayName,
  walletBalance,
  unreadSupport,
  isAdmin,
  isShipper,
  isDropoffLocation,
  shopAccess,
  onActiveAccountChange,
  onSignOut,
}: HeaderAccountMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [switchOpen, setSwitchOpen] = useState(false)
  const openingSwitchRef = useRef(false)
  /** Ignore the click that opened the menu so it does not also open the switcher. */
  const openedAtRef = useRef(0)
  const canSwitchAccount = (shopAccess?.options.length ?? 0) > 1
  const workingShop = canSwitchAccount && shopAccess?.actingAsShop === true ? shopAccess : null
  const menuName = workingShop ? workingShop.shopLabel : resolvedDisplayName
  const menuInitial = workingShop
    ? headerInitialFromDisplayName(workingShop.shopLabel)
    : resolvedInitial

  const onOpenChange = useCallback((open: boolean) => {
    if (open) openedAtRef.current = Date.now()
    setMenuOpen(open)
    if (!open) forceReleaseBodyScrollLock()
  }, [])

  const openAccountSwitcher = useCallback((event: Event) => {
    if (Date.now() - openedAtRef.current < 300) {
      event.preventDefault()
      return
    }
    openingSwitchRef.current = true
  }, [])

  return (
    <>
    <DropdownMenu modal={false} open={menuOpen} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9 text-foreground md:h-10 md:w-10">
          <Avatar className="h-8 w-8 md:h-9 md:w-9">
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
      <DropdownMenuContent
        align="end"
        className="z-[120] max-h-[min(32rem,calc(100dvh-5rem))] w-72 overflow-y-auto"
        onCloseAutoFocus={(event) => {
          if (!openingSwitchRef.current) return
          event.preventDefault()
          openingSwitchRef.current = false
          setSwitchOpen(true)
        }}
      >
        {canSwitchAccount && shopAccess ? (
          <DropdownMenuItem
            className="cursor-pointer items-center gap-3 px-2 py-2 hover:bg-neutral-100 hover:text-foreground focus:bg-neutral-100 focus:text-foreground data-[highlighted]:bg-neutral-100 data-[highlighted]:text-foreground dark:hover:bg-neutral-800 dark:hover:text-foreground dark:focus:bg-neutral-800 dark:focus:text-foreground dark:data-[highlighted]:bg-neutral-800 dark:data-[highlighted]:text-foreground"
            aria-haspopup="dialog"
            onSelect={openAccountSwitcher}
          >
            <ProfileAvatar
              profileAvatarUrl={profileAvatarUrl}
              avatarImageFailed={avatarImageFailed}
              onAvatarImageFailed={onAvatarImageFailed}
              initial={menuInitial}
              imageAlt=""
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{menuName}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
              <p className="truncate text-xs font-medium text-muted-foreground">Switch account</p>
            </div>
            <ChevronRight className="text-muted-foreground" aria-hidden />
          </DropdownMenuItem>
        ) : (
          <div className="flex items-center gap-3 px-2 py-2">
            <ProfileAvatar
              profileAvatarUrl={profileAvatarUrl}
              avatarImageFailed={avatarImageFailed}
              onAvatarImageFailed={onAvatarImageFailed}
              initial={resolvedInitial}
              imageAlt=""
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{resolvedDisplayName}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            </div>
          </div>
        )}
        {dashboardNavSections({
          isAdmin,
          isShipper,
          isDropoffLocation,
          hasShopifyAccess: shopAccess?.hasShopifyAccess === true,
          showEarnings: shopAccess ? shopAccess.showEarnings : true,
        }).map((section) => (
          <div key={section.id}>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs font-semibold text-foreground">
              {section.label}
            </DropdownMenuLabel>
            {section.links.map((link) => {
              const Icon = link.icon
              const itemKey = link.id ?? link.href
              if (link.href === "/dashboard/earnings") {
                return (
                  <DropdownMenuItem key={itemKey} asChild>
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
              if (link.href === "/dashboard/support") {
                return (
                  <DropdownMenuItem key={itemKey} asChild>
                    <Link href={link.href} className="flex items-center justify-between">
                      <span className="flex items-center">
                        <Icon className="mr-2 h-4 w-4" />
                        {link.name}
                      </span>
                      <NavUnreadCountBadge count={unreadSupport} className="h-4 min-w-4 text-[10px]" />
                    </Link>
                  </DropdownMenuItem>
                )
              }
              return (
                <DropdownMenuItem key={itemKey} asChild>
                  <Link href={link.href} className="flex items-center">
                    <Icon className="mr-2 h-4 w-4" />
                    {link.name}
                  </Link>
                </DropdownMenuItem>
              )
            })}
          </div>
        ))}
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
    {canSwitchAccount && shopAccess ? (
      <AccountSwitchDialog
        open={switchOpen}
        onOpenChange={setSwitchOpen}
        options={shopAccess.options}
        activeAccountId={shopAccess.activeAccountId}
        actorUserId={shopAccess.actorUserId}
        actorEmail={shopAccess.actorEmail}
        onActivated={onActiveAccountChange}
      />
    ) : null}
    </>
  )
}

export const HeaderAccountMenu = memo(HeaderAccountMenuInner)
