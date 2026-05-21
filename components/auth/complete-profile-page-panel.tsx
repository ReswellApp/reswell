"use client"

import { useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"
import { resolveProfileCompletionReturnPath } from "@/lib/auth/profile-completion-return-path"

/**
 * Legacy / bookmarked `/auth/complete-profile` URLs — send users to their `next` target
 * (usually `/`) so {@link ProfileCompletionRequiredDialog} can open over the homepage.
 */
export function CompleteProfilePagePanel() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const returnPath = resolveProfileCompletionReturnPath(
    "/auth/complete-profile",
    searchParams,
  )

  useEffect(() => {
    router.replace(returnPath)
  }, [returnPath, router])

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6" aria-hidden>
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )
}
