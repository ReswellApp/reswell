"use client"

import { useRef, useState } from "react"
import { ImagePlus, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { uploadMessageMediaFile } from "@/lib/message-media-upload-client"
import { sendConversationMediaReply } from "@/app/actions/messages"
import { getPolicyBlockFromSendResult } from "@/lib/messages/policy-block-client"
import type { MessagePolicyReasonCode } from "@/lib/messages/fraud-reason-codes"
import { raceWithDeadline } from "@/lib/utils/race-with-deadline"
import type { MarketplaceMessageAttachment } from "@/lib/validations/marketplace-message-attachment"

const MEDIA_SEND_SERVER_ACTION_MS = 45_000

type SentMediaMessage = {
  id: string
  content: string
  sender_id: string
  created_at: string
  is_read: boolean
  metadata: { attachment: MarketplaceMessageAttachment }
}

export function MessageMediaSendButton({
  conversationId,
  disabled,
  caption,
  onSent,
  onBlockedPolicy,
  className,
  ensureConversationId,
}: {
  conversationId: string | null
  disabled?: boolean
  caption?: string
  onSent: (message: SentMediaMessage) => void
  onBlockedPolicy?: (originalContent: string, reasonCode: MessagePolicyReasonCode) => void
  className?: string
  /** Creates the conversation on demand when media is the first message. */
  ensureConversationId?: () => Promise<string | null>
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const supabase = createClient()
  const supabaseProjectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""

  async function handleFilesSelected(files: FileList | null) {
    if (!files?.length || uploading || disabled) return

    const file = files[0]
    if (!file) return

    setUploading(true)
    try {
      let targetConversationId = conversationId
      if (!targetConversationId && ensureConversationId) {
        targetConversationId = await ensureConversationId()
      }
      if (!targetConversationId) {
        toast.error("Could not start the conversation. Try sending a message first.")
        return
      }

      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.access_token) {
        toast.error("Sign in again to send photos and videos.")
        return
      }

      const uploaded = await uploadMessageMediaFile({
        file,
        conversationId: targetConversationId,
        supabaseUrl: supabaseProjectUrl,
        accessToken: session.access_token,
        anonKey: supabaseAnonKey,
      })

      const result = await raceWithDeadline(
        sendConversationMediaReply({
          conversation_id: targetConversationId,
          attachment: uploaded.attachment,
          caption: caption?.trim() || undefined,
        }),
        MEDIA_SEND_SERVER_ACTION_MS,
      )

      if ("error" in result) {
        const policyReason = getPolicyBlockFromSendResult(result)
        if (policyReason) {
          onBlockedPolicy?.(caption?.trim() || "", policyReason)
          return
        }
        toast.error(typeof result.error === "string" ? result.error : "Could not send media")
        return
      }

      onSent(result.message)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send media")
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        className="sr-only"
        disabled={disabled || uploading}
        onChange={(e) => {
          void handleFilesSelected(e.target.files)
        }}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={disabled || uploading}
        className={cn(
          "h-10 w-10 shrink-0 rounded-full border-0 bg-transparent text-muted-foreground shadow-none hover:bg-transparent hover:text-foreground",
          className,
        )}
        aria-label="Send photo or video"
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? (
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        ) : (
          <ImagePlus className="h-5 w-5" strokeWidth={2} aria-hidden />
        )}
      </Button>
    </>
  )
}
