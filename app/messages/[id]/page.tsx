import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { loadConversationThread } from '@/app/actions/messages'
import { ConversationThreadClient } from '@/components/features/messages/conversation-thread-client'

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
      <main className="flex flex-1 flex-col bg-background">
        <div className="container mx-auto flex max-w-2xl flex-1 flex-col items-center justify-center px-4 py-16 text-center sm:px-5 md:max-w-4xl lg:max-w-5xl">
          <p className="text-[17px] font-medium text-foreground">Conversation not found</p>
          <p className="mt-2 max-w-sm text-[15px] text-muted-foreground">
            This thread may have been removed or you may not have access.
          </p>
          <Button asChild className="mt-6 rounded-full" variant="outline">
            <Link href="/messages">Back to messages</Link>
          </Button>
        </div>
      </main>
    )
  }

  return <ConversationThreadClient key={id} conversationId={id} initialData={result} />
}
