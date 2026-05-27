"use client"

import * as DialogPrimitive from "@radix-ui/react-dialog"
import Image from "next/image"
import { useCallback, useEffect, useRef, useState } from "react"
import { Minus, Plus, RotateCcw, X } from "lucide-react"
import {
  TransformComponent,
  TransformWrapper,
  type ReactZoomPanPinchContentRef,
} from "react-zoom-pan-pinch"
import { Dialog, DialogClose, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const ZOOM_TOLERANCE = 0.015
const MESSAGE_MEDIA_LIGHTBOX_Z = "z-[200]"

function usePrefersCoarsePointer() {
  const [coarse, setCoarse] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(pointer: coarse)").matches : false,
  )

  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)")
    const sync = () => setCoarse(mq.matches)
    sync()
    mq.addEventListener("change", sync)
    return () => mq.removeEventListener("change", sync)
  }, [])

  return coarse
}

interface MessageMediaImageLightboxProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  src: string
  title: string
}

export function MessageMediaImageLightbox({
  open,
  onOpenChange,
  src,
  title,
}: MessageMediaImageLightboxProps) {
  const [scale, setScale] = useState(1)
  const pinchRef = useRef<ReactZoomPanPinchContentRef | null>(null)
  const coarsePointer = usePrefersCoarsePointer()
  const isZoomedOut = scale <= 1 + ZOOM_TOLERANCE

  useEffect(() => {
    if (!open) setScale(1)
  }, [open])

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        pinchRef.current?.resetTransform(0)
        setScale(1)
      }
      onOpenChange(next)
    },
    [onOpenChange],
  )

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogPortal>
        <DialogOverlay className={cn(MESSAGE_MEDIA_LIGHTBOX_Z, "touch-none bg-background")} />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          onPointerDownOutside={(e) => {
            if (!isZoomedOut) e.preventDefault()
          }}
          onInteractOutside={(e) => {
            if (!isZoomedOut) e.preventDefault()
          }}
          className={cn(
            MESSAGE_MEDIA_LIGHTBOX_Z,
            "fixed inset-0 flex min-h-0 min-w-0 flex-col outline-none",
            "duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          )}
        >
          <DialogTitle className="sr-only">{title}</DialogTitle>

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
                  <TransformWrapper
                    key={src}
                    ref={pinchRef}
                    initialScale={1}
                    minScale={1}
                    maxScale={5}
                    centerOnInit
                    centerZoomedOut
                    limitToBounds
                    smooth
                    wheel={{ step: 0.12 }}
                    panning={{
                      allowLeftClickPan: true,
                      velocityDisabled: coarsePointer ? true : false,
                    }}
                    pinch={{
                      step: 5,
                      allowPanning: true,
                    }}
                    doubleClick={{ mode: "toggle", step: 2.2 }}
                    onTransform={(_ctx, state) => {
                      setScale(state.scale)
                    }}
                  >
                    <TransformComponent
                      wrapperClass="!h-full !w-full max-md:!h-fit max-md:!w-fit max-md:!max-h-full max-md:!max-w-full"
                      contentClass="!relative !h-full !w-full max-md:!h-fit max-md:!w-fit max-md:!max-h-full max-md:!max-w-full"
                    >
                      <Image
                        src={src}
                        alt={title}
                        width={2400}
                        height={3200}
                        unoptimized
                        draggable={false}
                        className={cn(
                          "select-none",
                          "block max-h-[min(88dvh,calc(100dvh-10rem))] w-auto max-w-full object-contain",
                          "md:absolute md:inset-0 md:h-full md:w-full md:max-h-none md:max-w-none md:object-cover md:object-center",
                        )}
                        sizes="(max-width: 768px) 100vw, (max-width: 1280px) 29rem, 32rem"
                        priority
                        onLoadingComplete={() => {
                          requestAnimationFrame(() => {
                            pinchRef.current?.centerView(1, 0)
                          })
                        }}
                      />
                    </TransformComponent>
                  </TransformWrapper>
                </div>

                <div className="absolute -bottom-12 inset-x-0 z-20 hidden justify-center sm:-bottom-14 md:flex">
                  <div className="flex items-center gap-1 rounded-full border border-border/60 bg-background/90 p-1.5 shadow-sm backdrop-blur-md">
                    <ZoomToolbar
                      onZoomIn={() => pinchRef.current?.zoomIn(0.18, 200)}
                      onZoomOut={() => pinchRef.current?.zoomOut(0.18, 200)}
                      onReset={() => pinchRef.current?.resetTransform(220)}
                      disableZoomOut={isZoomedOut}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 justify-center px-3 pb-[max(env(safe-area-inset-bottom),1rem)] pt-3 md:hidden">
            <div className="flex items-center gap-1 rounded-full border border-border/60 bg-background/90 p-1.5 shadow-sm backdrop-blur-md">
              <ZoomToolbar
                onZoomIn={() => pinchRef.current?.zoomIn(0.18, 200)}
                onZoomOut={() => pinchRef.current?.zoomOut(0.18, 200)}
                onReset={() => pinchRef.current?.resetTransform(220)}
                disableZoomOut={isZoomedOut}
              />
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  )
}

function ZoomToolbar({
  onZoomIn,
  onZoomOut,
  onReset,
  disableZoomOut,
}: {
  onZoomIn: () => void
  onZoomOut: () => void
  onReset: () => void
  disableZoomOut: boolean
}) {
  return (
    <>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-10 w-10 rounded-full text-foreground hover:bg-muted/60 hover:text-foreground"
        onClick={onZoomOut}
        disabled={disableZoomOut}
        aria-label="Zoom out"
      >
        <Minus className="size-5 stroke-[2]" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-10 w-10 rounded-full text-foreground hover:bg-muted/60 hover:text-foreground"
        onClick={onReset}
        aria-label="Reset zoom"
      >
        <RotateCcw className="size-5 stroke-[2]" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-10 w-10 rounded-full text-foreground hover:bg-muted/60 hover:text-foreground"
        onClick={onZoomIn}
        aria-label="Zoom in"
      >
        <Plus className="size-5 stroke-[2]" />
      </Button>
    </>
  )
}
