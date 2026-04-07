'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

/** Legacy URL: retail seller fields lived here; Profile tab is now under Settings. */
export default function DashboardProfilePage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/dashboard/settings')
  }, [router])

  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
      <span className="sr-only">Redirecting to profile settings…</span>
    </div>
  )
}
