"use client"

import { useCallback, useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import {
  getActiveImpersonationClient,
  clearImpersonation,
  IMPERSONATION_CHANGED_EVENT,
  type ImpersonationData,
} from "@/lib/impersonation"
import { HEADER_AUTH_REFRESH_EVENT } from "@/lib/auth/header-auth-refresh"
import { Button } from "@/components/ui/button"
import { LogOut } from "lucide-react"
import { cn } from "@/lib/utils"

export function ImpersonationActingAsStrip({
  target,
  exiting = false,
  onExit,
  className,
}: {
  target: ImpersonationData
  exiting?: boolean
  onExit?: () => void
  className?: string
}) {
  return (
    <div
      role="status"
      className={cn(
        "flex w-full items-center justify-center gap-3 border-b border-amber-300/80 bg-amber-100 px-3 py-2 text-sm text-amber-950 dark:border-amber-700/80 dark:bg-amber-950/90 dark:text-amber-50",
        className,
      )}
    >
      <span className="min-w-0 text-center font-medium">
        Acting as <span className="whitespace-nowrap">{target.displayName}</span>
        {target.email ? (
          <span className="text-amber-900/90 dark:text-amber-200/90"> ({target.email})</span>
        ) : null}
      </span>
      {onExit ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 shrink-0 border-amber-800/30 bg-white/80 text-amber-950 hover:bg-white dark:border-amber-400/40 dark:bg-amber-900/50 dark:text-amber-50 dark:hover:bg-amber-900"
          disabled={exiting}
          onClick={() => void onExit()}
        >
          <LogOut className="mr-1.5 h-3.5 w-3.5" aria-hidden />
          Exit
        </Button>
      ) : null}
    </div>
  )
}

/**
 * Full-width strip above the main header when an admin is impersonating another user.
 * Prefers the server admin flag so a client `profiles.is_admin` miss cannot hide the bar.
 */
export function ImpersonationBanner({
  initialIsAdmin = false,
  initialTarget = null,
}: {
  initialIsAdmin?: boolean
  initialTarget?: ImpersonationData | null
}) {
  const supabase = createClient()
  const router = useRouter()
  const pathname = usePathname()
  const [isAdmin, setIsAdmin] = useState(initialIsAdmin)
  const [target, setTarget] = useState<ImpersonationData | null>(initialTarget)
  const [authReady, setAuthReady] = useState(initialIsAdmin)
  const [exiting, setExiting] = useState(false)

  const refreshTarget = useCallback(() => {
    setTarget(getActiveImpersonationClient() ?? initialTarget)
  }, [initialTarget])

  const syncAdmin = useCallback(async () => {
    if (initialIsAdmin) {
      setIsAdmin(true)
      setAuthReady(true)
      refreshTarget()
      return
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setIsAdmin(false)
      setTarget(null)
      setAuthReady(true)
      return
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle()

    const admin = profile?.is_admin === true
    setIsAdmin(admin)
    setAuthReady(true)
    if (!admin) {
      setTarget(null)
      return
    }
    refreshTarget()
  }, [initialIsAdmin, refreshTarget, supabase])

  useEffect(() => {
    void syncAdmin()
  }, [syncAdmin, pathname])

  useEffect(() => {
    function onImpersonationChanged() {
      refreshTarget()
    }
    function onAuthRefresh() {
      void syncAdmin()
    }
    window.addEventListener(HEADER_AUTH_REFRESH_EVENT, onAuthRefresh)
    window.addEventListener(IMPERSONATION_CHANGED_EVENT, onImpersonationChanged)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void syncAdmin()
    })
    return () => {
      window.removeEventListener(HEADER_AUTH_REFRESH_EVENT, onAuthRefresh)
      window.removeEventListener(IMPERSONATION_CHANGED_EVENT, onImpersonationChanged)
      subscription.unsubscribe()
    }
  }, [refreshTarget, supabase, syncAdmin])

  async function handleExit() {
    if (exiting) return
    setExiting(true)
    try {
      await fetch("/api/admin/impersonate", {
        method: "DELETE",
        credentials: "include",
      })
    } finally {
      clearImpersonation()
      setTarget(null)
      setExiting(false)
      router.refresh()
      void syncAdmin()
    }
  }

  if (!authReady || !isAdmin || !target) {
    return null
  }

  return (
    <ImpersonationActingAsStrip
      target={target}
      exiting={exiting}
      onExit={() => void handleExit()}
    />
  )
}
