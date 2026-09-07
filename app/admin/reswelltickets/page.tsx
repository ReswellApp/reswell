import { Suspense } from 'react'
import { Loader2 } from 'lucide-react'
import { ReswellTicketsClient } from '@/components/features/admin/reswell-tickets/reswell-tickets-client'

export default function AdminReswellTicketsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
          <p className="text-sm">Loading…</p>
        </div>
      }
    >
      <ReswellTicketsClient />
    </Suspense>
  )
}
