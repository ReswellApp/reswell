"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { LogOut } from "lucide-react"
import { setActiveShopAccountAction } from "@/lib/actions/accountMembers"
import { dispatchHeaderAuthRefresh } from "@/lib/auth/header-auth-refresh"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * Full-width strip while a signed-in person is working inside a shop they were
 * added to. Same role as the admin impersonation bar: the session stays theirs,
 * and Exit returns them to that login.
 */
export function WorkingOnAccountBanner({
  shopLabel,
  onExited,
  className,
}: {
  shopLabel: string
  onExited: () => void
  className?: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const label = shopLabel.trim() || "this shop"

  function exit() {
    if (pending) return
    setError(null)
    startTransition(async () => {
      const result = await setActiveShopAccountAction({ accountId: null })
      if ("error" in result && result.error) {
        setError(result.error)
        return
      }
      onExited()
      dispatchHeaderAuthRefresh()
      router.refresh()
    })
  }

  return (
    <div
      role="status"
      className={cn(
        "flex w-full flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-amber-300/80 bg-amber-100 px-3 py-2 text-sm text-amber-950 dark:border-amber-700/80 dark:bg-amber-950/90 dark:text-amber-50",
        className,
      )}
    >
      <span className="min-w-0 text-center font-medium">
        Working on <span className="font-semibold">{label}</span> account
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 shrink-0 border-amber-800/30 bg-white/80 text-amber-950 hover:bg-white dark:border-amber-400/40 dark:bg-amber-900/50 dark:text-amber-50 dark:hover:bg-amber-900"
        disabled={pending}
        onClick={exit}
      >
        <LogOut className="mr-1.5 h-3.5 w-3.5" aria-hidden />
        {pending ? "Exiting…" : "Exit"}
      </Button>
      {error ? (
        <span className="max-w-[14rem] truncate text-xs font-normal" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  )
}
