"use client"

import { useState, type ReactNode } from "react"
import Image from "next/image"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { MessageMediaImageLightbox } from "@/components/features/messages/message-media-image-lightbox"
import { OpenMarketplacePdfButton } from "@/components/features/messages/open-marketplace-pdf-button"
import {
  MessageMediaVideoLightbox,
  MessageMediaVideoPreviewOverlay,
} from "@/components/features/messages/message-media-video-lightbox"
import {
  composeMediaAttachmentMessageBody,
  parseMarketplaceMessageImageAttachment,
  parseMarketplaceMessagePdfAttachment,
  parseMarketplaceMessageVideoAttachment,
} from "@/lib/validations/marketplace-message-attachment"
import { MessageTextBubble } from "@/components/features/messages/message-text-bubble"

const messageMediaShellClass =
  "max-w-[min(100%,12.5rem)] sm:max-w-[min(100%,14rem)] md:max-w-[min(100%,17rem)]"
const messageMediaFrameClass =
  "overflow-hidden rounded-[20px] shadow-[0_1px_3px_rgba(17,17,17,0.12)]"
const messageMediaMaxSizeClass = "max-h-[min(42vh,15rem)] w-auto max-w-full object-contain"

function MessageMediaAttachmentImage({
  messageId,
  fileName,
  className,
  onOpenImage,
}: {
  messageId: string
  fileName: string
  className?: string
  /** When set, parent owns the lightbox (thread-wide gallery). */
  onOpenImage?: (messageId: string) => void
}) {
  const attachmentPath = `/api/messages/${messageId}/attachment`
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const useParentGallery = typeof onOpenImage === "function"

  return (
    <div className={cn("relative overflow-hidden", className)}>
      {!loaded && !failed ? (
        <div className="flex aspect-[4/3] w-full min-w-[8rem] items-center justify-center bg-muted/30">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
        </div>
      ) : null}
      {failed ? (
        <div className="flex aspect-[4/3] w-full min-w-[8rem] items-center justify-center bg-muted/30 px-3 text-center text-sm text-muted-foreground">
          Could not load photo
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={() => {
              if (useParentGallery) {
                onOpenImage(messageId)
                return
              }
              setLightboxOpen(true)
            }}
            className="block cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label={`View photo: ${fileName}`}
          >
            <Image
              src={attachmentPath}
              alt={fileName}
              width={320}
              height={240}
              unoptimized
              className={cn(messageMediaMaxSizeClass, !loaded && "absolute inset-0 opacity-0")}
              onLoad={() => setLoaded(true)}
              onError={() => {
                setFailed(true)
                setLoaded(true)
              }}
            />
          </button>
          {!useParentGallery ? (
            <MessageMediaImageLightbox
              open={lightboxOpen}
              onOpenChange={setLightboxOpen}
              src={attachmentPath}
              title={fileName}
            />
          ) : null}
        </>
      )}
    </div>
  )
}

function MessageMediaAttachmentVideo({
  messageId,
  fileName,
  className,
}: {
  messageId: string
  fileName: string
  className?: string
}) {
  const attachmentPath = `/api/messages/${messageId}/attachment`
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [frameReady, setFrameReady] = useState(false)
  const [failed, setFailed] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setLightboxOpen(true)}
        className={cn(
          "relative block cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          className,
        )}
        aria-label={`Play video: ${fileName}`}
      >
        {!frameReady ? (
          <div className="flex aspect-[3/4] w-full min-w-[8rem] items-center justify-center bg-muted/30">
            {failed ? (
              <span className="px-3 text-center text-sm text-muted-foreground">Video</span>
            ) : (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
            )}
          </div>
        ) : null}
        {!failed ? (
          <video
            // The #t fragment forces mobile Safari to decode and paint the
            // first frame, which it skips with plain preload="metadata".
            src={`${attachmentPath}#t=0.001`}
            playsInline
            preload="metadata"
            muted
            className={cn(messageMediaMaxSizeClass, !frameReady && "absolute inset-0 opacity-0")}
            onLoadedData={() => setFrameReady(true)}
            onError={() => setFailed(true)}
            aria-hidden
          />
        ) : null}
        <MessageMediaVideoPreviewOverlay />
      </button>
      <MessageMediaVideoLightbox
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
        src={attachmentPath}
        fileName={fileName}
      />
    </>
  )
}

function LocalMediaPreview({
  url,
  kind,
  fileName,
  sendStatus,
  progress,
}: {
  url: string
  kind: "image" | "video"
  fileName: string
  sendStatus?: "sending" | "failed"
  progress?: number
}) {
  const sending = sendStatus === "sending"
  const pct = Math.max(0, Math.min(100, Math.round(progress ?? 0)))
  return (
    <div className={cn("relative min-h-[8rem] min-w-[8rem] overflow-hidden bg-muted/30", messageMediaFrameClass)}>
      {kind === "video" ? (
        <video
          src={url}
          muted
          playsInline
          preload="metadata"
          className={messageMediaMaxSizeClass}
          aria-hidden
        />
      ) : (
        // Local blob preview — next/image cannot load blob: URLs.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={fileName} className={messageMediaMaxSizeClass} />
      )}
      {sending ? (
        <>
          <div className="absolute inset-0 bg-black/20" aria-hidden />
          <div className="absolute inset-x-0 bottom-0 h-1 bg-black/25">
            <div
              className="h-full bg-white/90 transition-[width] duration-150"
              style={{ width: `${pct}%` }}
            />
          </div>
        </>
      ) : null}
    </div>
  )
}

export function MessageMediaAttachmentCard({
  messageId,
  metadata,
  content,
  isOwn,
  formattedTime,
  showTime = true,
  onOpenImage,
  localPreviewUrl,
  localPreviewKind,
  sendStatus,
  progress,
  onRetryFailed,
}: {
  messageId: string
  metadata: unknown
  content: string
  isOwn: boolean
  formattedTime: ReactNode
  /** Per-item timestamps clutter an iMessage-style thread; group labels cover this. */
  showTime?: boolean
  /** Opens a parent-owned image gallery (swipe across thread photos). */
  onOpenImage?: (messageId: string) => void
  /** Optimistic outgoing photo/video still uploading from this device. */
  localPreviewUrl?: string
  localPreviewKind?: "image" | "video"
  sendStatus?: "sending" | "failed"
  progress?: number
  onRetryFailed?: () => void
}) {
  const imageAtt = parseMarketplaceMessageImageAttachment(metadata)
  const videoAtt = parseMarketplaceMessageVideoAttachment(metadata)
  const pdfAtt = parseMarketplaceMessagePdfAttachment(metadata)

  const defaultBody = imageAtt
    ? composeMediaAttachmentMessageBody("image")
    : videoAtt
      ? composeMediaAttachmentMessageBody("video")
      : localPreviewKind
        ? composeMediaAttachmentMessageBody(localPreviewKind)
        : null
  const redundantCaption =
    defaultBody != null && content.trim() === defaultBody

  if (imageAtt || videoAtt || localPreviewUrl) {
    const previewKind = localPreviewKind ?? (videoAtt ? "video" : "image")
    return (
      <div className={cn("flex flex-col gap-1.5", messageMediaShellClass, isOwn && "items-end")}>
        {localPreviewUrl ? (
          <LocalMediaPreview
            url={localPreviewUrl}
            kind={previewKind}
            fileName={imageAtt?.file_name ?? videoAtt?.file_name ?? (previewKind === "video" ? "Video" : "Photo")}
            sendStatus={sendStatus}
            progress={progress}
          />
        ) : imageAtt ? (
          <MessageMediaAttachmentImage
            messageId={messageId}
            fileName={imageAtt.file_name}
            className={messageMediaFrameClass}
            onOpenImage={onOpenImage}
          />
        ) : videoAtt ? (
          <MessageMediaAttachmentVideo
            messageId={messageId}
            fileName={videoAtt.file_name}
            className={messageMediaFrameClass}
          />
        ) : null}
        {!redundantCaption && content.trim() ? (
          <MessageTextBubble content={content} isOwn={isOwn} />
        ) : null}
        {isOwn && sendStatus === "failed" ? (
          <button
            type="button"
            className="px-0.5 text-[11px] font-medium text-red-500"
            onClick={onRetryFailed}
          >
            Not Delivered — Tap to Retry
          </button>
        ) : null}
        {showTime ? (
          <p
            className={cn(
              "px-0.5 text-[11px] tabular-nums leading-none text-muted-foreground",
              isOwn && "text-right",
            )}
          >
            {formattedTime}
          </p>
        ) : null}
      </div>
    )
  }

  return (
    <MessageTextBubble content={content} isOwn={isOwn} className="sm:py-2.5">
      {pdfAtt ? (
        <OpenMarketplacePdfButton
          messageId={messageId}
          fileName={pdfAtt.file_name}
          variant="secondary"
          className={cn(
            "w-full justify-start",
            isOwn && "border-white/35 bg-white/15 text-white hover:bg-white/25",
          )}
        />
      ) : null}
      {!redundantCaption && content.trim() ? (
        <p className="mt-2 whitespace-pre-wrap break-words text-[17px] leading-[1.35] tracking-[-0.01em]">
          {content}
        </p>
      ) : null}
      {showTime ? (
        <p
          className={cn(
            "mt-1 text-[11px] tabular-nums leading-none",
            isOwn ? "text-white/55" : "text-muted-foreground",
          )}
        >
          {formattedTime}
        </p>
      ) : null}
    </MessageTextBubble>
  )
}
