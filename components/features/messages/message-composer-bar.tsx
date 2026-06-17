'use client'

import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MessageComposerTextarea } from '@/components/features/messages/message-composer-textarea'
import { MessageMediaSendButton } from '@/components/features/messages/message-media-send-button'
import { cn } from '@/lib/utils'
import {
  messageComposerFormClass,
  messageComposerInputShellClass,
  messageComposerSendButtonClass,
} from '@/lib/utils/dashboard-display-styles'
import type { MessagePolicyReasonCode } from '@/lib/messages/fraud-reason-codes'
import type { MarketplaceMessageAttachment } from '@/lib/validations/marketplace-message-attachment'

type SentMediaMessage = {
  id: string
  content: string
  sender_id: string
  created_at: string
  is_read: boolean
  metadata: { attachment: MarketplaceMessageAttachment }
}

export interface MessageComposerBarProps {
  value: string
  onChange: React.ChangeEventHandler<HTMLTextAreaElement>
  onSubmit: () => void | Promise<void>
  sending?: boolean
  className?: string
  placeholder?: string
  textareaDisabled?: boolean
  showMedia?: boolean
  media?: {
    conversationId: string | null
    disabled?: boolean
    onSent: (message: SentMediaMessage) => void
    onBlockedPolicy?: (originalContent: string, reasonCode: MessagePolicyReasonCode) => void
    ensureConversationId?: () => Promise<string | null>
  }
}

export function MessageComposerBar({
  value,
  onChange,
  onSubmit,
  sending = false,
  className,
  placeholder = 'Send a message',
  textareaDisabled = false,
  showMedia = true,
  media,
}: MessageComposerBarProps) {
  const disabled = sending || textareaDisabled

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void onSubmit()
      }}
      className={cn(messageComposerFormClass, className)}
    >
      {showMedia && media ? (
        <MessageMediaSendButton
          conversationId={media.conversationId}
          disabled={disabled || media.disabled}
          caption={value}
          onSent={media.onSent}
          onBlockedPolicy={media.onBlockedPolicy}
          ensureConversationId={media.ensureConversationId}
        />
      ) : null}
      <div className={messageComposerInputShellClass}>
        <MessageComposerTextarea
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          aria-label="Message text"
        />
        <Button
          type="submit"
          variant="ghost"
          disabled={disabled || !value.trim()}
          className={messageComposerSendButtonClass}
          aria-label="Send message"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : 'Send'}
        </Button>
      </div>
    </form>
  )
}
