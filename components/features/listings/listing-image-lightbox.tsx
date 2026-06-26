"use client"

import * as DialogPrimitive from "@radix-ui/react-dialog"
import Image from "next/image"
import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Minus, Plus, RotateCcw, X } from "lucide-react"
import {
  TransformComponent,
  TransformWrapper,
  type ReactZoomPanPinchContentRef,
} from "react-zoom-pan-pinch"
import { Dialog, DialogClose, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog"
import { ListingImageCarouselNavButton } from "@/components/features/listings/listing-image-carousel-nav-button"
import { Button } from "@/components/ui/button"
import { ListingTileShimmer } from "@/components/ui/skeleton"
import {
  listingImageShouldBypassOptimization,
  withListingMediaPdpVariant,
} from "@/lib/listing-media-proxy-url"
import { portraitShimmer } from "@/lib/image-shimmer"
import { cn } from "@/lib/utils"

const ZOOM_TOLERANCE = 0.015

function useMaxMd() {
  const [match, setMatch] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 767px)").matches : false,
  )

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)")
    const sync = () => setMatch(mq.matches)
    sync()
    mq.addEventListener("change", sync)
    return () => mq.removeEventListener("change", sync)
  }, [])

  return match
}

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
  /** Natural width/height for the active slide — reserves mobile frame before decode. */
  mobileAspectRatio?: number
}

export function ListingImageLightbox({
  open,
  onOpenChange,
  proxiedUrls,
  title,
  index,
  onIndexChange,
  mobileAspectRatio = 3 / 4,
}: ListingImageLightboxProps) {
  const [scale, setScale] = useState(1)
  /** Track which full-res src has decoded so we can fade it over the cached low-res underlay. */
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null)
  const [placeholderLoaded, setPlaceholderLoaded] = useState(false)
  const pinchRef = useRef<ReactZoomPanPinchContentRef | null>(null)
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)
  const coarsePointer = usePrefersCoarsePointer()
  const isMaxMd = useMaxMd()

  const count = proxiedUrls.length
  const src = proxiedUrls[index]
  /** ≤1024px hero variant — already cached from the gallery, so the enlarge feels instant. */
  const placeholderSrc = useMemo(
    () => (src && src !== "/placeholder.svg" ? withListingMediaPdpVariant(src) : ""),
    [src],
  )

  useEffect(() => {
    if (!open) setScale(1)
  }, [open])

  useEffect(() => {
    setScale(1)
  }, [index])

  useEffect(() => {
    setLoadedSrc(null)
    setPlaceholderLoaded(false)
  }, [src])

  useEffect(() => {
    if (!open || !placeholderSrc) return

    const img = new window.Image()
    img.decoding = "async"
    img.src = placeholderSrc
    if (img.complete && img.naturalWidth > 0) {
      setPlaceholderLoaded(true)
      return
    }

    const markPlaceholderLoaded = () => setPlaceholderLoaded(true)
    img.addEventListener("load", markPlaceholderLoaded)
    return () => img.removeEventListener("load", markPlaceholderLoaded)
  }, [open, placeholderSrc])

  useEffect(() => {
    if (!open || !src) return

    const img = new window.Image()
    img.decoding = "async"
    img.src = src
    if (img.complete && img.naturalWidth > 0) {
      setLoadedSrc(src)
      requestAnimationFrame(() => {
        pinchRef.current?.centerView(1, 0)
      })
      return
    }

    const markFullLoaded = () => {
      setLoadedSrc(src)
      requestAnimationFrame(() => {
        pinchRef.current?.centerView(1, 0)
      })
    }
    img.addEventListener("load", markFullLoaded)
    return () => img.removeEventListener("load", markFullLoaded)
  }, [open, src])

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
  const slideReady = loadedSrc === src || placeholderLoaded
  const mobileFrameStyle = useMemo(
    () =>
      ({
        aspectRatio: mobileAspectRatio,
        width: `min(calc(100vw - 1rem), calc(min(88dvh, calc(100dvh - 10rem)) * ${mobileAspectRatio}))`,
        maxWidth: "calc(100vw - 1rem)",
        maxHeight: "min(88dvh, calc(100dvh - 10rem))",
      }) as CSSProperties,
    [mobileAspectRatio],
  )

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogPortal>
        <DialogOverlay className="z-[70] touch-none bg-background" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          onPointerDownOutside={(e) => {
            if (!isZoomedOut) e.preventDefault()
          }}
          onInteractOutside={(e) => {
            if (!isZoomedOut) e.preventDefault()
          }}
          className={cn(
            // Above `SiteHeaderShell` (z-[60]) so close + overlay cover the marketplace nav on /l
            "fixed inset-0 z-[70] flex min-h-0 min-w-0 flex-col outline-none",
            "duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          )}
        >
          <DialogTitle className="sr-only">
            {title} — photo {index + 1} of {Math.max(count, 1)}
          </DialogTitle>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col pt-[max(env(safe-area-inset-top),0.75rem)]">
            <div
              className="relative flex min-h-0 min-w-0 flex-1 items-center justify-center px-10 sm:px-12 md:px-16"
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
              {src ? (
                <div className="relative mx-auto flex shrink-0 flex-col gap-2 sm:gap-2.5">
                  <div className="flex items-center justify-between gap-3">
                    {count > 1 ? (
                      <p className="min-w-0 truncate text-[15px] font-medium tabular-nums text-foreground/80">
                        {index + 1} / {count}
                      </p>
                    ) : (
                      <span aria-hidden />
                    )}
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
                  style={isMaxMd ? mobileFrameStyle : undefined}
                  className={cn(
                    "relative shrink-0 overflow-hidden rounded-xl bg-muted sm:rounded-2xl",
                    "md:aspect-[3/4] md:h-auto md:w-[29rem] md:max-w-[min(29rem,calc(100vw-3rem))] xl:w-[32rem] xl:max-w-[min(32rem,calc(100vw-3rem))]",
                  )}
                >
                  {count > 1 ? (
                    <>
                      <ListingImageCarouselNavButton
                        direction="prev"
                        variant="lightbox"
                        sideClassName="pointer-events-auto left-3 z-20 sm:left-4 md:left-5"
                        srLabel="Previous photo"
                        onClick={goPrev}
                      />
                      <ListingImageCarouselNavButton
                        direction="next"
                        variant="lightbox"
                        sideClassName="pointer-events-auto right-3 z-20 sm:right-4 md:right-5"
                        srLabel="Next photo"
                        onClick={goNext}
                      />
                    </>
                  ) : null}
                  <ListingTileShimmer
                    aria-hidden
                    className={cn(
                      "listing-tile-shimmer-overlay absolute inset-0 z-[1] rounded-xl sm:rounded-2xl",
                      slideReady && "pointer-events-none opacity-0",
                    )}
                  />
                  <div className="absolute inset-0">
                    <TransformWrapper
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
                      wrapperClass="!h-full !w-full"
                      contentClass="!relative !h-full !w-full"
                    >
                      {placeholderSrc ? (
                        <Image
                          key={placeholderSrc}
                          aria-hidden
                          src={placeholderSrc}
                          alt=""
                          fill
                          unoptimized={listingImageShouldBypassOptimization(placeholderSrc)}
                          draggable={false}
                          placeholder="blur"
                          blurDataURL={portraitShimmer}
                          className={cn(
                            "pointer-events-none select-none object-contain transition-opacity duration-300 ease-out",
                            "md:object-cover md:object-center",
                            loadedSrc === src ? "opacity-0" : "opacity-100",
                          )}
                          sizes="(max-width: 768px) 100vw, (max-width: 1280px) 29rem, 32rem"
                          priority
                          onLoadingComplete={() => {
                            setPlaceholderLoaded(true)
                          }}
                        />
                      ) : null}
                      <Image
                        key={src}
                        src={src}
                        alt={`${title} — full size ${index + 1}`}
                        fill
                        unoptimized
                        draggable={false}
                        className={cn(
                          "select-none object-contain transition-opacity duration-300 ease-out",
                          "md:object-cover md:object-center",
                          loadedSrc === src ? "opacity-100" : "opacity-0",
                        )}
                        sizes="(max-width: 768px) 100vw, (max-width: 1280px) 29rem, 32rem"
                        priority
                        onLoadingComplete={() => {
                          setLoadedSrc(src)
                          requestAnimationFrame(() => {
                            pinchRef.current?.centerView(1, 0)
                          })
                        }}
                      />
                    </TransformComponent>
                  </TransformWrapper>
                  </div>
                </div>
                </div>
              ) : null}

              <div className="pointer-events-none absolute inset-x-10 bottom-0 z-20 hidden justify-center sm:inset-x-12 md:flex md:inset-x-16">
                <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-border/60 bg-background/90 p-1.5 shadow-sm backdrop-blur-md">
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
