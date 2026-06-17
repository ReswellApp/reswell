'use client'

import { useCallback, useLayoutEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

/** ~5 lines at 17px / 1.35 line-height — then scroll inside the bubble. */
const MAX_COMPOSER_HEIGHT_PX = 132

export type MessageComposerTextareaProps = React.ComponentProps<'textarea'>

export function MessageComposerTextarea({
  className,
  value,
  onChange,
  disabled,
  ...props
}: MessageComposerTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null)

  const syncHeight = useCallback(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    const next = Math.min(el.scrollHeight, MAX_COMPOSER_HEIGHT_PX)
    el.style.height = `${next}px`
    el.style.overflowY = el.scrollHeight > MAX_COMPOSER_HEIGHT_PX ? 'auto' : 'hidden'
  }, [])

  useLayoutEffect(() => {
    syncHeight()
  }, [value, syncHeight])

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      disabled={disabled}
      onChange={(e) => {
        onChange?.(e)
        requestAnimationFrame(syncHeight)
      }}
      className={cn(
        'min-h-touch min-w-0 flex-1 resize-none border-0 bg-transparent px-3 py-2.5 text-[17px] leading-[1.35] tracking-[-0.01em] shadow-none placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}
