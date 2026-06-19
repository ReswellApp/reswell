import Link from "next/link"
import Image from "next/image"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { getStoreHubContext } from "@/lib/store-hub-access"
import {
  getStoreConversationThread,
  markStoreThreadReadByShop,
} from "@/lib/db/storeConversations"
import { cn } from "@/lib/utils"
import { StoreConversationReply } from "@/components/features/consignment/store-conversation-reply"

export const dynamic = "force-dynamic"

export default async function StoreMessageThreadPage({
  params,
}: {
  params: Promise<{ slug: string; conversationId: string }>
}) {
  const { slug, conversationId } = await params
  const { store } = await getStoreHubContext(slug)

  const thread = await getStoreConversationThread(store.id, conversationId)
  if (!thread) {
    notFound()
  }

  await markStoreThreadReadByShop(conversationId, store.ownerProfileId)

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col lg:h-[calc(100vh-6rem)]">
      <div className="flex items-center gap-3 border-b pb-3">
        <Link
          href={`/stores/${slug}/messages`}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted"
          aria-label="Back to messages"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-muted">
          {thread.listingCoverUrl ? (
            <Image
              src={thread.listingCoverUrl}
              alt={thread.listingTitle}
              fill
              sizes="40px"
              className="object-cover"
            />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{thread.buyerName}</p>
          <p className="truncate text-xs text-muted-foreground">
            {thread.listingSlug ? (
              <Link href={`/listings/${thread.listingSlug}`} className="hover:underline">
                {thread.listingTitle}
              </Link>
            ) : (
              thread.listingTitle
            )}
            {thread.consignorName ? ` · Consignor: ${thread.consignorName}` : ""}
          </p>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto py-4">
        {thread.messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No messages yet.</p>
        ) : (
          thread.messages.map((m) => (
            <div
              key={m.id}
              className={cn("flex", m.fromShop ? "justify-end" : "justify-start")}
            >
              <div
                className={cn(
                  "max-w-[75%] rounded-2xl px-3.5 py-2 text-sm",
                  m.fromShop
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground",
                )}
              >
                <p className="whitespace-pre-wrap break-words">{m.content}</p>
                <p
                  className={cn(
                    "mt-1 text-[10px]",
                    m.fromShop ? "text-primary-foreground/70" : "text-muted-foreground",
                  )}
                >
                  {new Date(m.createdAt).toLocaleString([], {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="border-t pt-3">
        <StoreConversationReply storeSlug={slug} conversationId={conversationId} />
      </div>
    </div>
  )
}
