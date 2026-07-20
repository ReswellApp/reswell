import { Suspense } from "react"
import { Loader2 } from "lucide-react"
import { privatePageMetadata } from "@/lib/site-metadata"
import { OpsAdminClient } from "@/components/features/admin/ops-admin-client"

export const metadata = privatePageMetadata({
  title: "Platform ops — Admin — Reswell",
  description: "Vercel, Supabase, and app error triage with internal fix tickets.",
  path: "/admin/ops",
})

export default function AdminOpsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
          <p className="text-sm">Loading…</p>
        </div>
      }
    >
      <OpsAdminClient />
    </Suspense>
  )
}
