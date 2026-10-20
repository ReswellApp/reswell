"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { Check } from "lucide-react"
import { setActiveShopAccountAction } from "@/lib/actions/accountMembers"
import { dispatchHeaderAuthRefresh } from "@/lib/auth/header-auth-refresh"
import { Button } from "@/components/ui/button"
import type { AccountRole } from "@/lib/account-access/permissions"
import {
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

export interface AccountSwitcherOption {
  accountId: string
  label: string
  role: AccountRole
}

interface AccountMenuSwitcherProps {
  options: AccountSwitcherOption[]
  activeAccountId: string
  actorUserId: string
  actorEmail: string | null
  onActivated?: (accountId: string | null) => void
}

const ROLE_LABEL: Record<AccountRole, string> = {
  owner: "You",
  manager: "Manager",
  staff: "Staff",
}

function accountTitle(option: AccountSwitcherOption, actorUserId: string): string {
  if (option.accountId === actorUserId) return "Personal"
  return option.label
}

/** Same two-letter mark as the profile account rows. */
function accountMark(label: string): string {
  const local = label.split("@")[0] ?? ""
  const parts = local.split(/[._+-]+/).filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase()
  }
  const compact = local.replace(/[^a-zA-Z0-9]/g, "")
  return (compact.slice(0, 2) || "?").toUpperCase()
}

/** Leaves the shop and opens the signed-in person's own account. */
export function OpenPersonalAccountButton({ className }: { className?: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  return (
    <div className={className}>
      <Button
        type="button"
        variant="outline"
        className="mt-2 h-8 rounded-full px-3 text-xs"
        disabled={pending}
        onClick={() => {
          setError(null)
          startTransition(async () => {
            const result = await setActiveShopAccountAction({ accountId: null })
            if ("error" in result && result.error) {
              setError(result.error)
              return
            }
            dispatchHeaderAuthRefresh()
            router.refresh()
          })
        }}
      >
        {pending ? "Opening…" : "Open personal"}
      </Button>
      {error ? (
        <p className="mt-1 text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export function AccountMenuSwitcher({
  options,
  activeAccountId,
  actorUserId,
  actorEmail,
  onActivated,
}: AccountMenuSwitcherProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  if (options.length < 2) return null

  const activeOption = options.find((option) => option.accountId === activeAccountId) ?? options[0]
  const activeTitle = activeOption ? accountTitle(activeOption, actorUserId) : "Personal"
  const openingTitle =
    pendingId != null
      ? accountTitle(
          options.find((option) => option.accountId === pendingId) ?? activeOption,
          actorUserId,
        )
      : null

  function openAccount(option: AccountSwitcherOption) {
    const personal = option.accountId === actorUserId
    if (option.accountId === activeAccountId || pending) return
    setError(null)
    setPendingId(option.accountId)
    const nextAccountId = personal ? null : option.accountId
    startTransition(async () => {
      const result = await setActiveShopAccountAction({ accountId: nextAccountId })
      if ("error" in result && result.error) {
        setError(result.error)
        setPendingId(null)
        return
      }
      onActivated?.(nextAccountId)
      dispatchHeaderAuthRefresh()
      router.refresh()
    })
  }

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className="items-center gap-2 py-2">
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">Switch account</span>
          <span className="block truncate text-xs text-muted-foreground">
            {pending && openingTitle ? `Opening ${openingTitle}…` : `Working in ${activeTitle}`}
          </span>
        </span>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="z-[130] w-64">
        {options.map((option) => {
          const active = option.accountId === activeAccountId
          const personal = option.accountId === actorUserId
          const title = accountTitle(option, actorUserId)
          return (
            <DropdownMenuItem
              key={option.accountId}
              className="items-center gap-2.5 py-2"
              onSelect={(event) => {
                event.preventDefault()
                openAccount(option)
              }}
            >
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
                  personal ? "bg-neutral-100 text-foreground" : "bg-neutral-950 text-white",
                )}
                aria-hidden
              >
                {accountMark(personal ? (actorEmail ?? title) : title)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{title}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {personal ? "Your login" : ROLE_LABEL[option.role]}
                </span>
              </span>
              {active ? (
                <>
                  <Check className="h-3.5 w-3.5 shrink-0 text-foreground" aria-hidden />
                  <span className="sr-only">Current account</span>
                </>
              ) : (
                <span className="sr-only">Open</span>
              )}
            </DropdownMenuItem>
          )
        })}
        {error ? (
          <p className="px-2 py-1 text-xs text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}
