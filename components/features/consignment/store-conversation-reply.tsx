"use client"

import { useActionState, useEffect, useRef } from "react"
import { useFormStatus } from "react-dom"
import { replyToStoreConversationAction } from "@/lib/actions/storeConversationActions"
import { cn } from "@/lib/utils"

interface StoreConversationReplyProps {
  storeSlug: string
  conversationId: string
  className?: string
}

function SendButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-10 shrink-0 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
    >
      {pending ? "Sending…" : "Send"}
    </button>
  )
}

export function StoreConversationReply({
  storeSlug,
  conversationId,
  className,
}: StoreConversationReplyProps) {
  const [state, formAction] = useActionState(replyToStoreConversationAction, null)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state && "success" in state) {
      formRef.current?.reset()
    }
  }, [state])

  return (
    <form ref={formRef} action={formAction} className={cn("space-y-2", className)}>
      <input type="hidden" name="storeSlug" value={storeSlug} />
      <input type="hidden" name="conversationId" value={conversationId} />
      <div className="flex items-end gap-2">
        <textarea
          name="content"
          required
          rows={2}
          placeholder="Reply as the shop…"
          className="min-h-10 flex-1 resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <SendButton />
      </div>
      {state && "error" in state ? (
        <p className="text-xs text-destructive">{state.error}</p>
      ) : null}
    </form>
  )
}
