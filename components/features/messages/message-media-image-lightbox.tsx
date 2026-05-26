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
        <DialogOverlay
          className={cn(MESSAGE_MEDIA_LIGHTBOX_Z, "touch-none bg-black/75")}
        />
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
            "fixed inset-0 flex items-center justify-center p-4 outline-none sm:p-6",
            "duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          )}
        >
          <DialogTitle className="sr-only">{title}</DialogTitle>

          <div className="relative flex w-fit max-w-[min(calc(100vw-2rem),19rem)] flex-col items-center gap-3 sm:max-w-[min(calc(100vw-3rem),24rem)] md:max-w-[min(calc(100vw-3rem),28rem)]">
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
                <TransformWrapper
                  key={src}
                  ref={pinchRef}
                  initialScale={1}
                  minScale={1}
                  maxScale={4}
                  centerOnInit
                  centerZoomedOut
                  limitToBounds
                  smooth
                  wheel={{ step: 0.12 }}
                  panning={{
                    allowLeftClickPan: true,
                    velocityDisabled: coarsePointer,
                  }}
                  pinch={{
                    step: 5,
                    allowPanning: true,
                  }}
                  doubleClick={{ mode: "toggle", step: 2 }}
                  onTransform={(_ctx, state) => {
                    setScale(state.scale)
                  }}
                >
                  <TransformComponent
                    wrapperClass="!w-fit !max-w-full"
                    contentClass="!w-fit !max-w-full"
                  >
                    <Image
                      src={src}
                      alt={title}
                      width={1200}
                      height={1600}
                      unoptimized
                      draggable={false}
                      className="block max-h-[min(48dvh,18rem)] w-auto max-w-full object-contain select-none sm:max-h-[min(52dvh,22rem)]"
                      sizes="(max-width: 640px) 19rem, 28rem"
                      priority
                    />
                  </TransformComponent>
                </TransformWrapper>
              </div>
            </div>

            <div className="flex shrink-0 justify-center">
              <div className="flex items-center gap-1 rounded-full border border-white/10 bg-black/55 p-1 backdrop-blur-xl">
                <ZoomToolbar
                  onZoomIn={() => pinchRef.current?.zoomIn(0.18, 200)}
                  onZoomOut={() => pinchRef.current?.zoomOut(0.18, 200)}
                  onReset={() => pinchRef.current?.resetTransform(220)}
                  disableZoomOut={isZoomedOut}
                />
              </div>
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
        className="h-9 w-9 rounded-full text-white hover:bg-white/15 hover:text-white"
        onClick={onZoomOut}
        disabled={disableZoomOut}
        aria-label="Zoom out"
      >
        <Minus className="size-4 stroke-[2]" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-9 w-9 rounded-full text-white hover:bg-white/15 hover:text-white"
        onClick={onReset}
        aria-label="Reset zoom"
      >
        <RotateCcw className="size-4 stroke-[2]" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-9 w-9 rounded-full text-white hover:bg-white/15 hover:text-white"
        onClick={onZoomIn}
        aria-label="Zoom in"
      >
        <Plus className="size-4 stroke-[2]" />
      </Button>
    </>
  )
}
