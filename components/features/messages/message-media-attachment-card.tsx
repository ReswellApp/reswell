"use client"

import { useState } from "react"
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

const messageMediaShellClass =
  "max-w-[min(100%,12.5rem)] sm:max-w-[min(100%,14rem)] md:max-w-[min(100%,17rem)]"
const messageMediaFrameClass =
  "overflow-hidden rounded-[20px] shadow-[0_1px_3px_rgba(17,17,17,0.12)]"
const messageMediaMaxSizeClass = "max-h-[min(42vh,15rem)] w-auto max-w-full object-contain"

function MessageMediaAttachmentImage({
  messageId,
  fileName,
  className,
}: {
  messageId: string
  fileName: string
  className?: string
}) {
  const attachmentPath = `/api/messages/${messageId}/attachment`
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)

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
            onClick={() => setLightboxOpen(true)}
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
          <MessageMediaImageLightbox
            open={lightboxOpen}
            onOpenChange={setLightboxOpen}
            src={attachmentPath}
            title={fileName}
          />
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
        <video
          playsInline
          preload="metadata"
          muted
          className={messageMediaMaxSizeClass}
          aria-hidden
        >
          <source src={attachmentPath} />
        </video>
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

function MessageTextBubble({
  content,
  isOwn,
}: {
  content: string
  isOwn: boolean
}) {
  return (
    <div
      className={cn(
        "max-w-[min(100%,18.5rem)] rounded-[20px] px-3.5 py-2 sm:max-w-[min(100%,20rem)] sm:px-4 sm:py-2.5 md:max-w-[min(100%,28rem)]",
        isOwn
          ? "rounded-br-[6px] bg-listingHeart text-white shadow-[0_1px_2px_rgba(53,81,133,0.22)]"
          : "rounded-bl-[6px] border border-border/45 bg-card text-foreground shadow-sm",
      )}
    >
      <p className="whitespace-pre-wrap break-words text-[17px] leading-[1.35] tracking-[-0.01em]">
        {content}
      </p>
    </div>
  )
}

export function MessageMediaAttachmentCard({
  messageId,
  metadata,
  content,
  isOwn,
  formattedTime,
}: {
  messageId: string
  metadata: unknown
  content: string
  isOwn: boolean
  formattedTime: string
}) {
  const imageAtt = parseMarketplaceMessageImageAttachment(metadata)
  const videoAtt = parseMarketplaceMessageVideoAttachment(metadata)
  const pdfAtt = parseMarketplaceMessagePdfAttachment(metadata)

  const defaultBody = imageAtt
    ? composeMediaAttachmentMessageBody("image")
    : videoAtt
      ? composeMediaAttachmentMessageBody("video")
      : null
  const redundantCaption =
    defaultBody != null && content.trim() === defaultBody

  if (imageAtt || videoAtt) {
    return (
      <div className={cn("flex flex-col gap-1.5", messageMediaShellClass, isOwn && "items-end")}>
        {imageAtt ? (
          <MessageMediaAttachmentImage
            messageId={messageId}
            fileName={imageAtt.file_name}
            className={messageMediaFrameClass}
          />
        ) : null}
        {videoAtt ? (
          <MessageMediaAttachmentVideo
            messageId={messageId}
            fileName={videoAtt.file_name}
            className={messageMediaFrameClass}
          />
        ) : null}
        {!redundantCaption && content.trim() ? (
          <MessageTextBubble content={content} isOwn={isOwn} />
        ) : null}
        <p
          className={cn(
            "px-0.5 text-[11px] tabular-nums leading-none text-muted-foreground",
            isOwn && "text-right",
          )}
        >
          {formattedTime}
        </p>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "max-w-[min(100%,18.5rem)] rounded-[20px] px-3.5 py-2 sm:max-w-[min(100%,20rem)] sm:px-4 sm:py-2.5 md:max-w-[min(100%,28rem)]",
        isOwn
          ? "rounded-br-[6px] bg-listingHeart text-white shadow-[0_1px_2px_rgba(53,81,133,0.22)]"
          : "rounded-bl-[6px] border border-border/45 bg-card text-foreground shadow-sm",
      )}
    >
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
      <p
        className={cn(
          "mt-1 text-[11px] tabular-nums leading-none",
          isOwn ? "text-white/55" : "text-muted-foreground",
        )}
      >
        {formattedTime}
      </p>
    </div>
  )
}
