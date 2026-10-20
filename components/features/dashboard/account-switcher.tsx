"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { Check } from "lucide-react"
import { setActiveShopAccountAction } from "@/lib/actions/accountMembers"
import { Button } from "@/components/ui/button"
import type { AccountRole } from "@/lib/account-access/permissions"
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
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
}: AccountMenuSwitcherProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  if (options.length < 2) return null

  return (
    <>
      <DropdownMenuLabel className="px-2 pt-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Accounts
      </DropdownMenuLabel>
      {options.map((option) => {
        const active = option.accountId === activeAccountId
        const personal = option.accountId === actorUserId
        return (
          <DropdownMenuItem
            key={option.accountId}
            disabled={pending}
            className="items-start gap-2 py-2"
            onSelect={(event) => {
              event.preventDefault()
              if (active) return
              setError(null)
              startTransition(async () => {
                const result = await setActiveShopAccountAction({
                  accountId: personal ? null : option.accountId,
                })
                if ("error" in result && result.error) {
                  setError(result.error)
                  return
                }
                router.refresh()
              })
            }}
          >
            <span
              className={cn(
                "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center",
                active ? "text-foreground" : "text-transparent",
              )}
            >
              <Check className="h-3.5 w-3.5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">
                {accountTitle(option, actorUserId)}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {personal ? "Your login" : ROLE_LABEL[option.role]}
              </span>
            </span>
          </DropdownMenuItem>
        )
      })}
      {error ? (
        <p className="px-2 pb-1 text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <DropdownMenuSeparator />
    </>
  )
}
