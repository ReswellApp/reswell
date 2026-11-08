import { ConversationThreadSkeleton } from "@/components/features/messages/messages-page-skeletons"
import { MessagesChatSplit } from "@/components/features/messages/messages-chat-split"

export default function ConversationLoading() {
  return (
    <MessagesChatSplit>
      <ConversationThreadSkeleton />
    </MessagesChatSplit>
  )
}
