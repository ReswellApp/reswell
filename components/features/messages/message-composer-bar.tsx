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
import type { OptimisticMediaDraft } from '@/components/features/messages/message-media-send-button'

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
    onSent: (message: SentMediaMessage, draftId: string) => void
    onBlockedPolicy?: (
      originalContent: string,
      reasonCode: MessagePolicyReasonCode,
      draftId?: string,
    ) => void
    ensureConversationId?: () => Promise<string | null>
    onOptimistic?: (draft: OptimisticMediaDraft) => void
    onProgress?: (draftId: string, progress: number) => void
    onFailed?: (draftId: string) => void
    onDismiss?: (draftId: string) => void
    registerRetry?: (retry: (draftId: string) => void) => void
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
            onDraftUiChange={media.onOptimistic ? undefined : handleDraftUiChange}
            onOptimistic={media.onOptimistic}
            onProgress={media.onProgress}
            onFailed={media.onFailed}
            onDismiss={media.onDismiss}
            registerRetry={media.registerRetry}
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
