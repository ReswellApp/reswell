"use client"

import { useState } from "react"
import Image from "next/image"
import { Loader2, Play } from "lucide-react"
import { cn } from "@/lib/utils"
import { MessageMediaImageLightbox } from "@/components/features/messages/message-media-image-lightbox"
import {
  MessageMediaVideoLightbox,
} from "@/components/features/messages/message-media-video-lightbox"
import { OpenMarketplacePdfButton } from "@/components/features/messages/open-marketplace-pdf-button"
import {
  composeMediaAttachmentMessageBody,
  parseMarketplaceMessageImageAttachment,
  parseMarketplaceMessagePdfAttachment,
  parseMarketplaceMessageVideoAttachment,
} from "@/lib/validations/marketplace-message-attachment"

const adminMediaFrameClass =
  "overflow-hidden rounded-xl border border-border/50 bg-background shadow-sm"
const adminMediaMaxSizeClass =
  "max-h-[min(52vh,22rem)] w-auto max-w-full object-contain sm:max-h-[min(56vh,26rem)]"

function AdminMessageImage({
  messageId,
  fileName,
}: {
  messageId: string
  fileName: string
}) {
  const attachmentPath = `/api/messages/${messageId}/attachment`
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)

  return (
    <div className={cn("relative max-w-[min(100%,28rem)]", adminMediaFrameClass)}>
      {!loaded && !failed ? (
        <div className="flex aspect-[4/3] w-full min-w-[12rem] items-center justify-center bg-muted/30">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
        </div>
      ) : null}
      {failed ? (
        <div className="flex aspect-[4/3] w-full min-w-[12rem] items-center justify-center bg-muted/30 px-3 text-center text-sm text-muted-foreground">
          Could not load photo
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setLightboxOpen(true)}
            className="group relative block w-full cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label={`Open photo: ${fileName}`}
          >
            <Image
              src={attachmentPath}
              alt={fileName}
              width={720}
              height={540}
              unoptimized
              className={cn(adminMediaMaxSizeClass, !loaded && "absolute inset-0 opacity-0")}
              onLoad={() => setLoaded(true)}
              onError={() => {
                setFailed(true)
                setLoaded(true)
              }}
            />
            {loaded ? (
              <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent px-3 pb-2.5 pt-8 text-left text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                Click to enlarge
              </span>
            ) : null}
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

function AdminMessageVideo({
  messageId,
  fileName,
}: {
  messageId: string
  fileName: string
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
          "group relative block max-w-[min(100%,28rem)] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          adminMediaFrameClass,
        )}
        aria-label={`Play video: ${fileName}`}
      >
        {!frameReady ? (
          <div className="flex aspect-[3/4] w-full min-w-[12rem] items-center justify-center bg-muted/30">
            {failed ? (
              <span className="px-3 text-center text-sm text-muted-foreground">Video</span>
            ) : (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
            )}
          </div>
        ) : null}
        {!failed ? (
          <video
            src={`${attachmentPath}#t=0.001`}
            playsInline
            preload="metadata"
            muted
            className={cn(adminMediaMaxSizeClass, !frameReady && "absolute inset-0 opacity-0")}
            onLoadedData={() => setFrameReady(true)}
            onError={() => setFailed(true)}
            aria-hidden
          />
        ) : null}
        {frameReady ? (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/25 transition-colors group-hover:bg-black/35">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-background/95 text-foreground shadow-md">
              <Play className="h-5 w-5 fill-current pl-0.5" aria-hidden />
            </span>
          </span>
        ) : null}
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

export function AdminMarketplaceMessageBody({
  messageId,
  metadata,
  content,
  className,
}: {
  messageId: string
  metadata: unknown
  content: string
  className?: string
}) {
  const imageAtt = parseMarketplaceMessageImageAttachment(metadata)
  const videoAtt = parseMarketplaceMessageVideoAttachment(metadata)
  const pdfAtt = parseMarketplaceMessagePdfAttachment(metadata)

  const defaultMediaBody = imageAtt
    ? composeMediaAttachmentMessageBody("image")
    : videoAtt
      ? composeMediaAttachmentMessageBody("video")
      : null
  const redundantCaption =
    (defaultMediaBody != null && content.trim() === defaultMediaBody) ||
    (pdfAtt != null && content.trim() === `Attachment: ${pdfAtt.file_name}`)

  return (
    <div className={cn("space-y-2", className)}>
      {imageAtt ? (
        <AdminMessageImage messageId={messageId} fileName={imageAtt.file_name} />
      ) : null}
      {videoAtt ? (
        <AdminMessageVideo messageId={messageId} fileName={videoAtt.file_name} />
      ) : null}
      {pdfAtt ? (
        <OpenMarketplacePdfButton messageId={messageId} fileName={pdfAtt.file_name} />
      ) : null}
      {!redundantCaption && content.trim() ? (
        <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-foreground">
          {content}
        </p>
      ) : null}
    </div>
  )
}
