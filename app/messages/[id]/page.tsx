import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { loadConversationThread } from '@/app/actions/messages'
import { ConversationThreadClient } from '@/components/features/messages/conversation-thread-client'
import { MessagesChatSplit } from '@/components/features/messages/messages-chat-split'

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const result = await loadConversationThread(id)

  if ('error' in result) {
    if (result.error === 'Unauthorized') {
      redirect(`/auth/login?redirect=/messages/${id}`)
    }

    return (
      <MessagesChatSplit activeConversationId={id}>
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 py-16 text-center">
          <p className="text-[17px] font-medium text-foreground">Conversation not found</p>
          <p className="mt-2 max-w-sm text-[15px] text-muted-foreground">
            This thread may have been removed or you may not have access.
          </p>
          <Button asChild className="mt-6 rounded-full" variant="outline">
            <Link href="/messages">Back to messages</Link>
          </Button>
        </div>
      </MessagesChatSplit>
    )
  }

  return (
    <MessagesChatSplit activeConversationId={id}>
      <ConversationThreadClient key={id} conversationId={id} initialData={result} embedded />
    </MessagesChatSplit>
  )
}
