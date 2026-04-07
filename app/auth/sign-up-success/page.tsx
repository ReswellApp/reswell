"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { Loader2 } from "lucide-react"

/** Legacy URL; email confirmation is off — send users to the app. */
export default function SignUpSuccessPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace("/dashboard")
  }, [router])
  return (
    <div className="flex min-h-svh items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-label="Redirecting" />
    </div>
  )
}
