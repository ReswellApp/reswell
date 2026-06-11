"use client"

import * as DialogPrimitive from "@radix-ui/react-dialog"
import { Loader2, Play, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

const MESSAGE_MEDIA_LIGHTBOX_Z = "z-[200]"

interface MessageMediaVideoLightboxProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  src: string
  fileName: string
}

export function MessageMediaVideoLightbox({
  open,
  onOpenChange,
  src,
  fileName,
}: MessageMediaVideoLightboxProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [ready, setReady] = useState(false)
  const [isPortrait, setIsPortrait] = useState(true)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    if (open) {
      void video.play().catch(() => {
        // Autoplay may be blocked until user interacts; controls remain available.
      })
      return
    }

    video.pause()
    video.currentTime = 0
    setReady(false)
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className={cn(MESSAGE_MEDIA_LIGHTBOX_Z, "touch-none bg-background")} />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className={cn(
            MESSAGE_MEDIA_LIGHTBOX_Z,
            "fixed inset-0 flex min-h-0 min-w-0 flex-col outline-none",
            "duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          )}
        >
          <DialogTitle className="sr-only">{fileName}</DialogTitle>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col pt-[max(env(safe-area-inset-top),0.75rem)]">
            <div className="relative flex min-h-0 min-w-0 flex-1 items-center justify-center px-10 sm:px-12 md:px-16">
              <div className="relative mx-auto min-w-0 max-w-full">
                <div className="absolute -top-11 inset-x-0 flex items-center justify-end gap-3 sm:-top-12">
                  <DialogClose asChild>
                    <Button
                      type="button"
                      size="icon"
                      variant="secondary"
                      className="h-11 w-11 shrink-0 rounded-full border border-border/55 bg-background/90 text-foreground shadow-sm backdrop-blur-md hover:bg-muted/40 [&_svg]:size-6"
                    >
                      <X className="stroke-[2]" />
                      <span className="sr-only">Close</span>
                    </Button>
                  </DialogClose>
                </div>

                <div
                  className={cn(
                    "relative shrink-0 overflow-hidden rounded-xl bg-black/90 sm:rounded-2xl",
                    "max-md:w-full max-md:max-w-[min(calc(100vw-1rem),100%)]",
                    isPortrait
                      ? "md:w-[29rem] md:max-w-[min(29rem,calc(100vw-3rem))] xl:w-[32rem] xl:max-w-[min(32rem,calc(100vw-3rem))]"
                      : "md:w-[min(56rem,calc(100vw-3rem))]",
                    // Hold a stable portrait frame until metadata arrives so the
                    // player never flashes the browser's default landscape box.
                    !ready && "aspect-[3/4] max-h-[min(88dvh,calc(100dvh-10rem))]",
                  )}
                >
                  {!ready ? (
                    <span className="absolute inset-0 flex items-center justify-center" aria-hidden>
                      <Loader2 className="h-7 w-7 animate-spin text-white/70" />
                    </span>
                  ) : null}
                  {open ? (
                    <video
                      ref={videoRef}
                      src={src}
                      controls
                      autoPlay
                      playsInline
                      preload="auto"
                      onLoadedMetadata={(event) => {
                        const video = event.currentTarget
                        setIsPortrait(video.videoHeight >= video.videoWidth)
                        setReady(true)
                      }}
                      className={cn(
                        "mx-auto block max-h-[min(88dvh,calc(100dvh-10rem))] w-auto max-w-full object-contain",
                        ready ? "opacity-100 transition-opacity duration-200" : "absolute inset-0 h-full opacity-0",
                      )}
                      aria-label={`Video: ${fileName}`}
                    />
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  )
}

export function MessageMediaVideoPreviewOverlay({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20",
        className,
      )}
      aria-hidden
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/45 text-white shadow-sm backdrop-blur-sm">
        <Play className="ml-0.5 h-5 w-5 fill-current stroke-[2]" />
      </span>
    </span>
  )
}
