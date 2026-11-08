'use client'

import { useCallback, useState, type KeyboardEvent, type ReactNode } from 'react'
import { ArrowUp, Loader2 } from 'lucide-react'
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
  /** Extra controls after the media button (e.g. seller “make an offer”). */
  leadingActions?: ReactNode
  unlock?: { ready: boolean; failed?: boolean }
  composerUnlockToken?: string | null
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
  placeholder = 'Message',
  textareaDisabled = false,
  showMedia = true,
  leadingActions,
  unlock,
  composerUnlockToken,
  media,
}: MessageComposerBarProps) {
  const unlockLocked = unlock ? !unlock.ready : false
  const disabled = sending || textareaDisabled || unlockLocked
  const resolvedPlaceholder = unlockLocked
    ? unlock?.failed
      ? 'Refresh to send messages'
      : 'One moment…'
    : placeholder
  const [mediaDraftUi, setMediaDraftUi] = useState<ReactNode>(null)
  const handleDraftUiChange = useCallback((node: ReactNode) => {
    setMediaDraftUi(node)
  }, [])
  const canSend = !disabled && Boolean(value.trim())

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return
    event.preventDefault()
    if (!canSend) return
    void onSubmit()
  }

  return (
    <div className={cn('flex w-full min-w-0 flex-col gap-2', className)}>
      {mediaDraftUi}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void onSubmit()
        }}
        className={messageComposerFormClass}
      >
        {showMedia && media ? (
          <MessageMediaSendButton
            conversationId={media.conversationId}
            disabled={disabled || media.disabled}
            caption={value}
            composerUnlockToken={composerUnlockToken}
            onSent={media.onSent}
            onBlockedPolicy={media.onBlockedPolicy}
            ensureConversationId={media.ensureConversationId}
            onDraftUiChange={handleDraftUiChange}
          />
        ) : null}
        {leadingActions}
        <div className={messageComposerInputShellClass}>
          <MessageComposerTextarea
            value={value}
            onChange={onChange}
            onKeyDown={handleKeyDown}
            placeholder={resolvedPlaceholder}
            disabled={disabled}
            autoComplete="off"
            enterKeyHint="send"
            aria-label="Message text"
          />
          <Button
            type="submit"
            variant="ghost"
            disabled={!canSend}
            className={messageComposerSendButtonClass}
            aria-label="Send message"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <ArrowUp className="h-4 w-4" strokeWidth={2.5} aria-hidden />
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
