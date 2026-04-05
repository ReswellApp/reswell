"use client"

import { useCallback, useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import {
  getActiveImpersonationClient,
  clearImpersonation,
  type ImpersonationData,
} from "@/lib/impersonation"
import { HEADER_AUTH_REFRESH_EVENT } from "@/lib/auth/header-auth-refresh"
import { Button } from "@/components/ui/button"
import { LogOut } from "lucide-react"
import { toast } from "sonner"

/**
 * Full-width strip above the main header when an admin is impersonating another user.
 * Only `profiles.is_admin` users can see this (impersonation APIs are admin-only).
 */
export function ImpersonationBanner() {
  const supabase = createClient()
  const router = useRouter()
  const pathname = usePathname()
  const [isAdmin, setIsAdmin] = useState(false)
  const [target, setTarget] = useState<ImpersonationData | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [exiting, setExiting] = useState(false)

  const sync = useCallback(async () => {
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
      .single()

    if (profile?.is_admin !== true) {
      setIsAdmin(false)
      setTarget(null)
      setAuthReady(true)
      return
    }

    setIsAdmin(true)
    setTarget(getActiveImpersonationClient())
    setAuthReady(true)
  }, [supabase])

  useEffect(() => {
    void sync()
  }, [sync, pathname])

  useEffect(() => {
    function onAuthRefresh() {
      void sync()
    }
    window.addEventListener(HEADER_AUTH_REFRESH_EVENT, onAuthRefresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void sync()
    })
    return () => {
      window.removeEventListener(HEADER_AUTH_REFRESH_EVENT, onAuthRefresh)
      subscription.unsubscribe()
    }
  }, [supabase, sync])

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
      toast.success("Stopped acting as user")
      void sync()
    }
  }

  if (!authReady || !isAdmin || !target) {
    return null
  }

  return (
    <div
      role="status"
      className="flex w-full items-center justify-center gap-3 border-b border-amber-300/80 bg-amber-100 px-3 py-2 text-sm text-amber-950 dark:border-amber-700/80 dark:bg-amber-950/90 dark:text-amber-50"
    >
      <span className="min-w-0 text-center font-medium">
        Acting as <span className="whitespace-nowrap">{target.displayName}</span>
        {target.email ? (
          <span className="text-amber-900/90 dark:text-amber-200/90"> ({target.email})</span>
        ) : null}
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 shrink-0 border-amber-800/30 bg-white/80 text-amber-950 hover:bg-white dark:border-amber-400/40 dark:bg-amber-900/50 dark:text-amber-50 dark:hover:bg-amber-900"
        disabled={exiting}
        onClick={() => void handleExit()}
      >
        <LogOut className="mr-1.5 h-3.5 w-3.5" aria-hidden />
        Exit
      </Button>
    </div>
  )
}
