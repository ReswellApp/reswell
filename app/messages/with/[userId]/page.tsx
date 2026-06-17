import { redirect } from "next/navigation"
import { loadCounterpartyThreads } from "@/app/actions/messages"
import { CounterpartyThreadsClient } from "@/components/features/messages/counterparty-threads-client"
import { MessagesChatSplit } from "@/components/features/messages/messages-chat-split"

export default async function CounterpartyThreadsPage({
  params,
}: {
  params: Promise<{ userId: string }>
}) {
  const { userId } = await params
  const result = await loadCounterpartyThreads(userId)

  if ("error" in result) {
    if (result.error === "Unauthorized") {
      redirect(`/auth/login?redirect=/messages/with/${userId}`)
    }
    redirect("/messages")
  }

  if (result.threads.length === 1) {
    redirect(`/messages/${result.threads[0].id}`)
  }

  return (
    <MessagesChatSplit>
      <CounterpartyThreadsClient otherUserId={userId} initialData={result} embedded />
    </MessagesChatSplit>
  )
}
