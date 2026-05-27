"use client"

import * as DialogPrimitive from "@radix-ui/react-dialog"
import { Play, X } from "lucide-react"
import { useEffect, useRef } from "react"
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
                    "relative shrink-0 overflow-hidden rounded-xl sm:rounded-2xl",
                    "max-md:w-full max-md:max-w-[min(calc(100vw-1rem),100%)]",
                    "md:aspect-[3/4] md:h-auto md:w-[29rem] md:max-w-[min(29rem,calc(100vw-3rem))] xl:w-[32rem] xl:max-w-[min(32rem,calc(100vw-3rem))]",
                  )}
                >
                  <video
                    ref={videoRef}
                    controls
                    playsInline
                    preload="metadata"
                    className={cn(
                      "block max-h-[min(88dvh,calc(100dvh-10rem))] w-auto max-w-full object-contain",
                      "md:absolute md:inset-0 md:h-full md:w-full md:max-h-none md:max-w-none md:object-cover md:object-center",
                    )}
                    aria-label={`Video: ${fileName}`}
                  >
                    <source src={src} />
                    Your browser does not support embedded video.
                  </video>
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
