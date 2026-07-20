import { Suspense } from "react"
import { Loader2 } from "lucide-react"
import { privatePageMetadata } from "@/lib/site-metadata"
import { OpsGroupDetailClient } from "@/components/features/admin/ops-group-detail-client"

export const metadata = privatePageMetadata({
  title: "Ops issue — Admin — Reswell",
  description: "Platform ops issue detail and fix tickets.",
  path: "/admin/ops",
})

export default async function AdminOpsGroupPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
          <p className="text-sm">Loading…</p>
        </div>
      }
    >
      <OpsGroupDetailClient groupId={id} />
    </Suspense>
  )
}
