"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

/** Legacy route; bank cashout UI was removed — send users back to earnings. */
export default function CashoutRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace("/dashboard/earnings")
  }, [router])

  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] px-4">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
      <p className="mt-4 text-sm text-muted-foreground">Redirecting to earnings…</p>
    </div>
  )
}
