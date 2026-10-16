"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { setActiveShopAccountAction } from "@/lib/actions/accountMembers"
import type { AccountRole } from "@/lib/account-access/permissions"
import { cn } from "@/lib/utils"

export interface AccountSwitcherOption {
  accountId: string
  label: string
  role: AccountRole
}

interface AccountSwitcherProps {
  options: AccountSwitcherOption[]
  activeAccountId: string
  actorUserId: string
}

export function AccountSwitcher({ options, activeAccountId, actorUserId }: AccountSwitcherProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  if (options.length < 2) return null

  return (
    <div className="space-y-2">
      <label htmlFor="active-shop-account" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Working in
      </label>
      <select
        id="active-shop-account"
        className={cn(
          "h-11 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm font-medium",
          pending && "opacity-60",
        )}
        value={activeAccountId}
        disabled={pending}
        onChange={(event) => {
          const next = event.target.value
          setError(null)
          startTransition(async () => {
            const result = await setActiveShopAccountAction({
              accountId: next === actorUserId ? null : next,
            })
            if ("error" in result && result.error) {
              setError(result.error)
              return
            }
            router.refresh()
          })
        }}
      >
        {options.map((option) => (
          <option key={option.accountId} value={option.accountId}>
            {option.accountId === actorUserId ? "My account" : `${option.label} · ${option.role}`}
          </option>
        ))}
      </select>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  )
}
