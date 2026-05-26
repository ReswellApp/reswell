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
        <DialogOverlay
          className={cn(MESSAGE_MEDIA_LIGHTBOX_Z, "touch-none bg-black/75")}
        />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className={cn(
            MESSAGE_MEDIA_LIGHTBOX_Z,
            "fixed inset-0 flex items-center justify-center p-4 outline-none sm:p-6",
            "duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          )}
        >
          <DialogTitle className="sr-only">{fileName}</DialogTitle>

          <div className="relative flex w-fit max-w-[min(calc(100vw-2rem),19rem)] flex-col items-center sm:max-w-[min(calc(100vw-3rem),24rem)] md:max-w-[min(calc(100vw-3rem),28rem)]">
            <div className="relative w-fit max-w-full">
              <DialogClose asChild>
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  className="absolute -right-1 -top-1 z-20 h-9 w-9 rounded-full border border-white/15 bg-black/70 text-white shadow-md backdrop-blur-md hover:bg-black/85 sm:right-0 sm:top-0 [&_svg]:size-5"
                >
                  <X className="stroke-[2]" />
                  <span className="sr-only">Close</span>
                </Button>
              </DialogClose>

              <div className="w-fit max-w-full overflow-hidden rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.35)]">
                <video
                  ref={videoRef}
                  controls
                  playsInline
                  preload="metadata"
                  className="block max-h-[min(48dvh,18rem)] w-auto max-w-full object-contain sm:max-h-[min(52dvh,22rem)]"
                  aria-label={`Video: ${fileName}`}
                >
                  <source src={src} />
                  Your browser does not support embedded video.
                </video>
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
