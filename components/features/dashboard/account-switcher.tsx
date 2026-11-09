"use client"

import { useRouter } from "next/navigation"
import { useRef, useState, useTransition } from "react"
import { Check } from "lucide-react"
import { setActiveShopAccountAction } from "@/lib/actions/accountMembers"
import { dispatchHeaderAuthRefresh } from "@/lib/auth/header-auth-refresh"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { AccountRole } from "@/lib/account-access/permissions"
import { cn } from "@/lib/utils"

export interface AccountSwitcherOption {
  accountId: string
  label: string
  role: AccountRole
}

interface AccountSwitchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
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

/** Accounts this login can work in. Opens from the profile row in the header menu. */
export function AccountSwitchDialog({
  open,
  onOpenChange,
  options,
  activeAccountId,
  actorUserId,
  actorEmail,
  onActivated,
}: AccountSwitchDialogProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const openedAtRef = useRef(0)
  const wasOpenRef = useRef(false)
  if (open !== wasOpenRef.current) {
    wasOpenRef.current = open
    if (open) openedAtRef.current = Date.now()
  }

  function retainThroughOpeningClick(event: { preventDefault: () => void }) {
    if (Date.now() - openedAtRef.current < 500) event.preventDefault()
  }

  const activeOption = options.find((option) => option.accountId === activeAccountId) ?? options[0]
  const activeTitle = activeOption ? accountTitle(activeOption, actorUserId) : "Personal"
  const openingOption =
    pendingId != null
      ? (options.find((option) => option.accountId === pendingId) ?? activeOption)
      : null
  const openingTitle = openingOption ? accountTitle(openingOption, actorUserId) : null

  function handleOpenChange(next: boolean) {
    if (!next) {
      setError(null)
      if (!pending) setPendingId(null)
    }
    onOpenChange(next)
  }

  function openAccount(option: AccountSwitcherOption) {
    if (pending) return
    if (option.accountId === activeAccountId) {
      handleOpenChange(false)
      return
    }
    const personal = option.accountId === actorUserId
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
      setPendingId(null)
      onOpenChange(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="z-[220] max-w-sm gap-0 overflow-hidden p-0 sm:rounded-2xl"
        overlayClassName="z-[220]"
        onFocusOutside={retainThroughOpeningClick}
        onPointerDownOutside={retainThroughOpeningClick}
        onInteractOutside={retainThroughOpeningClick}
      >
        <DialogHeader className="space-y-1 px-5 pb-4 pr-12 pt-5 text-left">
          <DialogTitle className="text-base">Switch account</DialogTitle>
          <DialogDescription>
            {pending && openingTitle
              ? `Opening ${openingTitle}…`
              : activeOption?.accountId === actorUserId
                ? "You're in your own account."
                : `You're working in ${activeTitle}.`}
          </DialogDescription>
        </DialogHeader>
        <ul className="max-h-[min(24rem,60dvh)] overflow-y-auto border-t border-border px-2 py-2">
          {options.map((option) => {
            const active = option.accountId === activeAccountId
            const personal = option.accountId === actorUserId
            const title = accountTitle(option, actorUserId)
            const opening = pendingId === option.accountId
            return (
              <li key={option.accountId}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors",
                    "hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    "disabled:pointer-events-none disabled:opacity-60 dark:hover:bg-neutral-800",
                    active && "bg-neutral-50 dark:bg-neutral-900",
                  )}
                  disabled={pending}
                  aria-current={active ? "true" : undefined}
                  onClick={() => openAccount(option)}
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
                    <span className="block truncate text-sm font-medium text-foreground">{title}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {opening ? "Opening…" : personal ? (actorEmail ?? "Your login") : ROLE_LABEL[option.role]}
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
                </button>
              </li>
            )
          })}
        </ul>
        {error ? (
          <p className="px-5 pb-4 text-xs text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
