"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { getImpersonation, clearImpersonationCookie, type ImpersonationData } from "@/lib/impersonation"
import { UserCog, LogOut } from "lucide-react"

const BANNER_HEIGHT = 48

export function ImpersonationBanner() {
  const router = useRouter()
  const [data, setData] = useState<ImpersonationData | null>(null)
  const [stopping, setStopping] = useState(false)

  useEffect(() => {
    setData(getImpersonation())
  }, [])

  if (!data) return null

  async function stop() {
    setStopping(true)
    await fetch("/api/admin/impersonate", { method: "DELETE" })
    clearImpersonationCookie()
    setData(null)
    router.push("/admin/users")
    router.refresh()
  }

  return (
    <>
      <div style={{ height: BANNER_HEIGHT }} />
      <div
        className="fixed top-0 left-0 right-0 z-[9999] bg-amber-400 text-black shadow-md"
        style={{ height: BANNER_HEIGHT }}
      >
        <div className="mx-auto flex h-full max-w-7xl items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="relative flex h-6 w-6 shrink-0 items-center justify-center">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-600/40" />
              <UserCog className="relative h-5 w-5" />
            </span>
            <span className="text-sm font-semibold truncate">
              You are acting as{" "}
              <span className="rounded bg-black/10 px-1.5 py-0.5 font-bold">
                {data.displayName}
              </span>
              {data.email && (
                <span className="ml-1 opacity-60 font-normal">({data.email})</span>
              )}
            </span>
          </div>
          <button
            onClick={() => void stop()}
            disabled={stopping}
            className="flex items-center gap-2 rounded-full bg-black px-4 py-1.5 text-xs font-bold text-white hover:bg-neutral-800 transition-colors shrink-0 disabled:opacity-50"
          >
            <LogOut className="h-3.5 w-3.5" />
            Stop Acting as User
          </button>
        </div>
      </div>
    </>
  )
}
