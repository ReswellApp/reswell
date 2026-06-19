import Link from "next/link"
import Image from "next/image"
import { getStoreHubContext } from "@/lib/store-hub-access"
import { listStoreConversations } from "@/lib/db/storeConversations"
import { StorePageHeader } from "@/components/features/consignment/store-page-header"
import { resolveStoreSectionMeta } from "@/lib/store-section-meta"

export const dynamic = "force-dynamic"

function timeAgo(iso: string | null): string {
  if (!iso) return ""
  const then = new Date(iso).getTime()
  const diffMs = Date.now() - then
  const mins = Math.round(diffMs / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days}d`
  return new Date(iso).toLocaleDateString()
}

export default async function StoreMessagesPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const { store } = await getStoreHubContext(slug)
  const { description } = resolveStoreSectionMeta(`/stores/${slug}/messages`, slug)

  const conversations = await listStoreConversations(store.id, store.ownerProfileId)

  return (
    <>
      <StorePageHeader title="Messages" description={description} />

      {conversations.length === 0 ? (
        <p className="rounded-lg border py-12 text-center text-sm text-muted-foreground">
          No buyer messages yet.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {conversations.map((c) => (
            <li key={c.conversationId}>
              <Link
                href={`/stores/${slug}/messages/${c.conversationId}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50"
              >
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-muted">
                  {c.listingCoverUrl ? (
                    <Image
                      src={c.listingCoverUrl}
                      alt={c.listingTitle}
                      fill
                      sizes="48px"
                      className="object-cover"
                    />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">{c.buyerName}</p>
                    {c.unreadCount > 0 ? (
                      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
                        {c.unreadCount}
                      </span>
                    ) : null}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{c.listingTitle}</p>
                  {c.lastMessagePreview ? (
                    <p className="truncate text-xs text-muted-foreground/80">
                      {c.lastMessagePreview}
                    </p>
                  ) : null}
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs text-muted-foreground">{timeAgo(c.lastMessageAt)}</p>
                  {c.consignorName ? (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Consignor: {c.consignorName}
                    </p>
                  ) : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
