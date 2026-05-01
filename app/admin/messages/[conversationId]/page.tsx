import { Suspense } from "react"
import { Loader2 } from "lucide-react"
import { privatePageMetadata } from "@/lib/site-metadata"
import { AdminMarketplaceMessageThreadClient } from "@/components/features/admin/admin-marketplace-message-thread-client"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ conversationId: string }>
}) {
  const { conversationId } = await params
  return privatePageMetadata({
    title: "Conversation — Admin — Reswell",
    description: "Admin read-only view of a marketplace message thread.",
    path: `/admin/messages/${conversationId}`,
  })
}

export default async function AdminMarketplaceMessageThreadPage({
  params,
}: {
  params: Promise<{ conversationId: string }>
}) {
  const { conversationId } = await params

  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
          <p className="text-sm">Loading…</p>
        </div>
      }
    >
      <AdminMarketplaceMessageThreadClient conversationId={conversationId} />
    </Suspense>
  )
}
