"use client"

import * as DialogPrimitive from "@radix-ui/react-dialog"
import useEmblaCarousel from "embla-carousel-react"
import Image from "next/image"
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
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
const DEFAULT_ASPECT_RATIO = 3 / 4

const LIGHTBOX_IMAGE_SIZES =
  "(max-width: 768px) 100vw, (max-width: 1280px) 92vw, 90vw"

const CHROME_BUTTON_CLASS =
  "h-11 w-11 shrink-0 rounded-full border border-border/55 bg-background/90 text-foreground shadow-sm backdrop-blur-md hover:bg-muted/40 [&_svg]:size-5"

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

function huggingFrameStyle(aspectRatio: number, isMaxMd: boolean): CSSProperties {
  const maxHeight = isMaxMd
    ? "min(90dvh, calc(100dvh - 6.5rem))"
    : "min(92dvh, calc(100dvh - 8.25rem))"
  const maxWidth = isMaxMd ? "calc(100vw - 1.25rem)" : "calc(100vw - 8.5rem)"
  return {
    aspectRatio,
    width: `min(${maxWidth}, calc(${maxHeight} * ${aspectRatio}))`,
    maxWidth,
    maxHeight,
  }
}

interface LightboxSlideProps {
  src: string
  title: string
  slideIndex: number
  isActive: boolean
  coarsePointer: boolean
  isMaxMd: boolean
  initialAspectRatio: number
  priority?: boolean
  onScaleChange: (scale: number) => void
  onBackdropClick: () => void
  registerPinchRef: (index: number, ref: ReactZoomPanPinchContentRef | null) => void
}

function LightboxSlide({
  src,
  title,
  slideIndex,
  isActive,
  coarsePointer,
  isMaxMd,
  initialAspectRatio,
  priority = false,
  onScaleChange,
  onBackdropClick,
  registerPinchRef,
}: LightboxSlideProps) {
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null)
  const [placeholderLoaded, setPlaceholderLoaded] = useState(false)
  const [aspectRatio, setAspectRatio] = useState(initialAspectRatio)
  const pinchRef = useRef<ReactZoomPanPinchContentRef | null>(null)

  const setPinchRef = useCallback(
    (node: ReactZoomPanPinchContentRef | null) => {
      pinchRef.current = node
      registerPinchRef(slideIndex, node)
    },
    [registerPinchRef, slideIndex],
  )

  const placeholderSrc = useMemo(
    () => (src && src !== "/placeholder.svg" ? withListingMediaPdpVariant(src) : ""),
    [src],
  )

  useEffect(() => {
    setAspectRatio(initialAspectRatio)
  }, [initialAspectRatio])

  useEffect(() => {
    if (!isActive) {
      pinchRef.current?.resetTransform(0)
      onScaleChange(1)
    }
  }, [isActive, onScaleChange])

  useEffect(() => {
    setLoadedSrc(null)
    setPlaceholderLoaded(false)
  }, [src])

  useEffect(() => {
    if (!placeholderSrc) return

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
  }, [placeholderSrc])

  useEffect(() => {
    if (!src) return

    const img = new window.Image()
    img.decoding = "async"
    img.src = src
    if (img.complete && img.naturalWidth > 0) {
      setLoadedSrc(src)
      if (isActive) {
        requestAnimationFrame(() => {
          pinchRef.current?.centerView(1, 0)
        })
      }
      return
    }

    const markFullLoaded = () => {
      setLoadedSrc(src)
      if (isActive) {
        requestAnimationFrame(() => {
          pinchRef.current?.centerView(1, 0)
        })
      }
    }
    img.addEventListener("load", markFullLoaded)
    return () => img.removeEventListener("load", markFullLoaded)
  }, [isActive, src])

  const slideReady = loadedSrc === src || placeholderLoaded
  const [scale, setScale] = useState(1)
  const isZoomedOut = scale <= 1 + ZOOM_TOLERANCE
  const scaleRef = useRef(1)
  scaleRef.current = scale
  const frameStyle = useMemo(
    () => huggingFrameStyle(aspectRatio, isMaxMd),
    [aspectRatio, isMaxMd],
  )

  useEffect(() => {
    if (!isActive) return
    if (scaleRef.current > 1 + ZOOM_TOLERANCE) return
    const id = requestAnimationFrame(() => {
      pinchRef.current?.centerView(1, 0)
    })
    return () => cancelAnimationFrame(id)
  }, [aspectRatio, isActive, isMaxMd])

  const rememberAspectRatio = (naturalWidth: number, naturalHeight: number) => {
    if (naturalWidth <= 0 || naturalHeight <= 0) return
    const next = naturalWidth / naturalHeight
    setAspectRatio((prev) => (Math.abs(prev - next) < 0.001 ? prev : next))
  }

  return (
    <div
      className="flex h-full w-full items-center justify-center"
      onClick={(event) => {
        if (event.target === event.currentTarget) onBackdropClick()
      }}
    >
      <div
        style={frameStyle}
        className="relative shrink-0 overflow-hidden rounded-xl bg-[#f5f5f7] shadow-sm ring-1 ring-black/[0.06] sm:rounded-2xl dark:bg-muted dark:ring-white/[0.08]"
        onClick={(event) => event.stopPropagation()}
      >
        <ListingTileShimmer
          aria-hidden
          className={cn(
            "listing-tile-shimmer-overlay absolute inset-0 z-[1] rounded-xl sm:rounded-2xl",
            slideReady && "pointer-events-none opacity-0",
          )}
        />
        <TransformWrapper
          ref={setPinchRef}
          disabled={!isActive}
          initialScale={1}
          minScale={1}
          maxScale={5}
          centerOnInit
          centerZoomedOut
          limitToBounds
          smooth
          wheel={{ step: 0.12, disabled: !isActive }}
          panning={{
            disabled: isZoomedOut,
            allowLeftClickPan: !isZoomedOut,
            velocityDisabled: coarsePointer,
          }}
          pinch={{
            step: 5,
            allowPanning: true,
            disabled: !isActive,
          }}
          doubleClick={{ mode: "toggle", step: 2.2, disabled: !isActive }}
          onTransform={(_ctx, state) => {
            setScale(state.scale)
            if (isActive) onScaleChange(state.scale)
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
                  "pointer-events-none select-none object-contain object-center transition-opacity duration-300 ease-out",
                  loadedSrc === src ? "opacity-0" : "opacity-100",
                )}
                sizes={LIGHTBOX_IMAGE_SIZES}
                priority={priority}
                onLoadingComplete={(img) => {
                  setPlaceholderLoaded(true)
                  rememberAspectRatio(img.naturalWidth, img.naturalHeight)
                }}
              />
            ) : null}
            <Image
              key={src}
              src={src}
              alt={`${title} — full size ${slideIndex + 1}`}
              fill
              unoptimized
              draggable={false}
              className={cn(
                "select-none object-contain object-center transition-opacity duration-300 ease-out",
                loadedSrc === src ? "opacity-100" : "opacity-0",
              )}
              sizes={LIGHTBOX_IMAGE_SIZES}
              priority={priority}
              onLoadingComplete={(img) => {
                setLoadedSrc(src)
                rememberAspectRatio(img.naturalWidth, img.naturalHeight)
                if (isActive) {
                  requestAnimationFrame(() => {
                    pinchRef.current?.centerView(1, 0)
                  })
                }
              }}
            />
          </TransformComponent>
        </TransformWrapper>
      </div>
    </div>
  )
}

interface ListingImageLightboxProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  proxiedUrls: string[]
  title: string
  /** Index controlled by parent (opening slide). */
  index: number
  onIndexChange: (next: number) => void
  /** Natural width/height per slide — sizes the photo frame before decode. */
  aspectRatios?: Record<number, number>
}

export function ListingImageLightbox({
  open,
  onOpenChange,
  proxiedUrls,
  title,
  index,
  onIndexChange,
  aspectRatios,
}: ListingImageLightboxProps) {
  const [scale, setScale] = useState(1)
  const pinchRefs = useRef<Map<number, ReactZoomPanPinchContentRef | null>>(new Map())
  const isZoomedOutRef = useRef(true)
  const coarsePointer = usePrefersCoarsePointer()
  const isMaxMd = useMaxMd()

  const count = proxiedUrls.length
  const isZoomedOut = scale <= 1 + ZOOM_TOLERANCE
  isZoomedOutRef.current = isZoomedOut
  const useSwipeCarousel = count > 1

  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: count > 1,
    startIndex: index,
    align: "center",
    duration: 28,
    dragThreshold: 8,
    watchDrag: () => isZoomedOutRef.current,
  })

  const registerPinchRef = useCallback(
    (slideIndex: number, ref: ReactZoomPanPinchContentRef | null) => {
      if (ref) pinchRefs.current.set(slideIndex, ref)
      else pinchRefs.current.delete(slideIndex)
    },
    [],
  )

  const handleActiveScaleChange = useCallback((nextScale: number) => {
    setScale(nextScale)
  }, [])

  useEffect(() => {
    if (!open) setScale(1)
  }, [open])

  useEffect(() => {
    if (!emblaApi || !open) return
    emblaApi.scrollTo(index, true)
  }, [emblaApi, open])

  useEffect(() => {
    if (!emblaApi) return
    const onSelect = () => {
      const nextIndex = emblaApi.selectedScrollSnap()
      if (nextIndex === index) return
      pinchRefs.current.get(index)?.resetTransform(0)
      setScale(1)
      onIndexChange(nextIndex)
    }
    emblaApi.on("select", onSelect)
    return () => {
      emblaApi.off("select", onSelect)
    }
  }, [emblaApi, index, onIndexChange])

  useEffect(() => {
    if (!emblaApi) return
    if (emblaApi.selectedScrollSnap() !== index) {
      emblaApi.scrollTo(index)
    }
  }, [emblaApi, index])

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        pinchRefs.current.get(index)?.resetTransform(0)
        setScale(1)
      }
      onOpenChange(next)
    },
    [index, onOpenChange],
  )

  const closeIfZoomedOut = useCallback(() => {
    if (!isZoomedOutRef.current) return
    handleOpenChange(false)
  }, [handleOpenChange])

  const goPrev = useCallback(() => {
    if (emblaApi && useSwipeCarousel) {
      emblaApi.scrollPrev()
      return
    }
    pinchRefs.current.get(index)?.resetTransform(0)
    setScale(1)
    onIndexChange(index === 0 ? count - 1 : index - 1)
  }, [count, emblaApi, index, onIndexChange, useSwipeCarousel])

  const goNext = useCallback(() => {
    if (emblaApi && useSwipeCarousel) {
      emblaApi.scrollNext()
      return
    }
    pinchRefs.current.get(index)?.resetTransform(0)
    setScale(1)
    onIndexChange(index === count - 1 ? 0 : index + 1)
  }, [count, emblaApi, index, onIndexChange, useSwipeCarousel])

  useEffect(() => {
    if (!open || count <= 1) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return
      if (!isZoomedOutRef.current) return
      event.preventDefault()
      if (event.key === "ArrowLeft") goPrev()
      else goNext()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [count, goNext, goPrev, open])

  const activePinchRef = pinchRefs.current.get(index) ?? null

  const renderSlide = (slideIndex: number, priority: boolean) => {
    const src = proxiedUrls[slideIndex]
    if (!src) return null
    return (
      <LightboxSlide
        src={src}
        title={title}
        slideIndex={slideIndex}
        isActive={slideIndex === index}
        coarsePointer={coarsePointer}
        isMaxMd={isMaxMd}
        initialAspectRatio={aspectRatios?.[slideIndex] ?? DEFAULT_ASPECT_RATIO}
        priority={priority}
        onScaleChange={handleActiveScaleChange}
        onBackdropClick={closeIfZoomedOut}
        registerPinchRef={registerPinchRef}
      />
    )
  }

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
            "fixed inset-0 z-[70] flex min-h-0 min-w-0 flex-col outline-none",
            "duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          )}
        >
          <DialogTitle className="sr-only">
            {title} — photo {index + 1} of {Math.max(count, 1)}
          </DialogTitle>

          <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between gap-3 px-4 pt-[max(env(safe-area-inset-top),0.75rem)] sm:px-5">
            {count > 1 ? (
              <p className="pointer-events-none min-w-0 truncate text-sm font-medium tabular-nums text-foreground/55">
                {index + 1}
                <span className="px-1 font-normal text-foreground/35">/</span>
                {count}
              </p>
            ) : (
              <span aria-hidden />
            )}
            <DialogClose asChild>
              <Button
                type="button"
                size="icon"
                variant="secondary"
                className={cn("pointer-events-auto", CHROME_BUTTON_CLASS)}
              >
                <X className="stroke-[2]" />
                <span className="sr-only">Close</span>
              </Button>
            </DialogClose>
          </div>

          <div className="relative min-h-0 min-w-0 flex-1">
            {count > 1 ? (
              <>
                <ListingImageCarouselNavButton
                  direction="prev"
                  variant="chrome"
                  sideClassName="pointer-events-auto left-3 hidden sm:left-4 md:left-5 md:inline-flex"
                  srLabel="Previous photo"
                  onClick={goPrev}
                />
                <ListingImageCarouselNavButton
                  direction="next"
                  variant="chrome"
                  sideClassName="pointer-events-auto right-3 hidden md:right-5 md:inline-flex"
                  srLabel="Next photo"
                  onClick={goNext}
                />
              </>
            ) : null}

            {count > 0 ? (
              useSwipeCarousel ? (
                <div ref={emblaRef} className="absolute inset-0 overflow-hidden">
                  <div className="flex h-full touch-pan-y will-change-transform">
                    {proxiedUrls.map((url, slideIndex) => (
                      <div
                        key={`${url}-${slideIndex}`}
                        className="relative h-full min-w-0 shrink-0 grow-0 basis-full"
                        aria-hidden={slideIndex !== index}
                      >
                        {renderSlide(slideIndex, slideIndex === index)}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="absolute inset-0">{renderSlide(0, true)}</div>
              )
            ) : null}

            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 hidden justify-center pb-[max(env(safe-area-inset-bottom),1rem)] md:flex">
              <div className="pointer-events-auto flex items-center gap-0.5 rounded-full border border-border/50 bg-background/90 p-1 shadow-sm backdrop-blur-md">
                <ZoomToolbar
                  onZoomIn={() => activePinchRef?.zoomIn(0.18, 200)}
                  onZoomOut={() => activePinchRef?.zoomOut(0.18, 200)}
                  onReset={() => activePinchRef?.resetTransform(220)}
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
        className="h-9 w-9 rounded-full text-foreground hover:bg-muted/60 hover:text-foreground"
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
        className="h-9 w-9 rounded-full text-foreground hover:bg-muted/60 hover:text-foreground"
        onClick={onReset}
        aria-label="Reset zoom"
      >
        <RotateCcw className="size-4 stroke-[2]" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-9 w-9 rounded-full text-foreground hover:bg-muted/60 hover:text-foreground"
        onClick={onZoomIn}
        aria-label="Zoom in"
      >
        <Plus className="size-4 stroke-[2]" />
      </Button>
    </>
  )
}
