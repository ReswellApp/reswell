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
import { ListingImageCarouselNavButton } from "@/components/features/listings/listing-image-carousel-nav-button"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const ZOOM_TOLERANCE = 0.015

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

interface ListingImageLightboxProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  proxiedUrls: string[]
  title: string
  /** Index controlled by parent (opening slide). */
  index: number
  onIndexChange: (next: number) => void
  sold?: boolean
}

export function ListingImageLightbox({
  open,
  onOpenChange,
  proxiedUrls,
  title,
  index,
  onIndexChange,
  sold,
}: ListingImageLightboxProps) {
  const [scale, setScale] = useState(1)
  const pinchRef = useRef<ReactZoomPanPinchContentRef | null>(null)
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)
  const coarsePointer = usePrefersCoarsePointer()

  const count = proxiedUrls.length
  const src = proxiedUrls[index]

  useEffect(() => {
    if (!open) setScale(1)
  }, [open])

  useEffect(() => {
    setScale(1)
  }, [index])

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

  const goPrev = useCallback(() => {
    pinchRef.current?.resetTransform(0)
    setScale(1)
    onIndexChange(index === 0 ? count - 1 : index - 1)
  }, [count, index, onIndexChange])

  const goNext = useCallback(() => {
    pinchRef.current?.resetTransform(0)
    setScale(1)
    onIndexChange(index === count - 1 ? 0 : index + 1)
  }, [count, index, onIndexChange])

  const isZoomedOut = scale <= 1 + ZOOM_TOLERANCE

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogPortal>
        <DialogOverlay className="touch-none bg-black/90 backdrop-blur-md" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          onPointerDownOutside={(e) => {
            if (!isZoomedOut) e.preventDefault()
          }}
          onInteractOutside={(e) => {
            if (!isZoomedOut) e.preventDefault()
          }}
          className={cn(
            "fixed inset-0 z-50 flex flex-col outline-none",
            "duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          )}
        >
          <DialogTitle className="sr-only">
            {title} — photo {index + 1} of {Math.max(count, 1)}
          </DialogTitle>

          <div className="flex shrink-0 items-center justify-between gap-3 px-3 pb-2 pt-[max(env(safe-area-inset-top),0.75rem)] sm:px-5">
            {count > 1 ? (
              <p className="min-w-0 truncate text-[15px] font-medium tabular-nums text-white/90">
                {index + 1} / {count}
              </p>
            ) : (
              <span className="w-10 shrink-0" aria-hidden />
            )}
            <DialogClose asChild>
              <Button
                type="button"
                size="icon"
                variant="secondary"
                className="ml-auto h-11 w-11 shrink-0 rounded-full border border-white/10 bg-white/12 text-white backdrop-blur-xl hover:bg-white/20 [&_svg]:size-6"
              >
                <X className="stroke-[2]" />
                <span className="sr-only">Close</span>
              </Button>
            </DialogClose>
          </div>

          <div
            className="relative flex min-h-0 flex-1 flex-col px-2 sm:px-4"
            onTouchStart={(e) => {
              if (!isZoomedOut || count <= 1) return
              const t = e.touches[0]
              if (!t) return
              touchStartRef.current = { x: t.clientX, y: t.clientY }
            }}
            onTouchEnd={(e) => {
              const start = touchStartRef.current
              touchStartRef.current = null
              if (!start || !isZoomedOut || count <= 1) return
              const t = e.changedTouches[0]
              if (!t) return
              const dx = t.clientX - start.x
              const dy = t.clientY - start.y
              if (Math.abs(dx) < 56) return
              if (Math.abs(dx) <= Math.abs(dy)) return
              if (dx > 0) goPrev()
              else goNext()
            }}
            onTouchCancel={() => {
              touchStartRef.current = null
            }}
          >
            <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl sm:rounded-2xl">
              {src ? (
                <TransformWrapper
                  key={`${index}-${src}`}
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
                    // Coarse pointers: pinch may translate the image while scaling (natural map-style gestures).
                    allowPanning: true,
                  }}
                  doubleClick={{ mode: "toggle", step: 2.2 }}
                  onTransform={(_ctx, state) => {
                    setScale(state.scale)
                  }}
                >
                  <TransformComponent
                    wrapperClass="!w-full !h-full"
                    contentClass="!w-full !h-full flex items-center justify-center"
                  >
                    <Image
                      src={src}
                      alt={`${title} — full size ${index + 1}`}
                      width={2400}
                      height={3200}
                      unoptimized
                      draggable={false}
                      className={cn(
                        "max-h-[min(88dvh,100%)] w-auto max-w-full object-contain select-none",
                        sold && "[filter:grayscale(30%)]",
                      )}
                      sizes="100vw"
                      priority
                    />
                  </TransformComponent>
                </TransformWrapper>
              ) : null}
            </div>

            {count > 1 && (
              <>
                <ListingImageCarouselNavButton
                  direction="prev"
                  variant="lightbox"
                  sideClassName="left-1 sm:left-3"
                  srLabel="Previous photo"
                  onClick={goPrev}
                />
                <ListingImageCarouselNavButton
                  direction="next"
                  variant="lightbox"
                  sideClassName="right-1 sm:right-3"
                  srLabel="Next photo"
                  onClick={goNext}
                />
              </>
            )}
          </div>

          <div className="flex shrink-0 justify-center px-3 pb-[max(env(safe-area-inset-bottom),1rem)] pt-3">
            <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/10 p-1.5 backdrop-blur-xl">
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
        className="h-10 w-10 rounded-full text-white hover:bg-white/15 hover:text-white"
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
        className="h-10 w-10 rounded-full text-white hover:bg-white/15 hover:text-white"
        onClick={onReset}
        aria-label="Reset zoom"
      >
        <RotateCcw className="size-5 stroke-[2]" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-10 w-10 rounded-full text-white hover:bg-white/15 hover:text-white"
        onClick={onZoomIn}
        aria-label="Zoom in"
      >
        <Plus className="size-5 stroke-[2]" />
      </Button>
    </>
  )
}
