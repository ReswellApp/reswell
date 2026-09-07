"use client"

import * as DialogPrimitive from "@radix-ui/react-dialog"
import useEmblaCarousel from "embla-carousel-react"
import Image from "next/image"
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react"
import { X } from "lucide-react"
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
  listingPhotoBackdropStyle,
  listingPhotoIsCached,
  preventNativeListingImageDrag,
} from "@/components/features/listings/listing-gallery-photo"
import {
  listingImageShouldBypassOptimization,
  withListingMediaPdpVariant,
} from "@/lib/listing-media-proxy-url"
import { cn } from "@/lib/utils"

const ZOOM_TOLERANCE = 0.015
const DEFAULT_ASPECT_RATIO = 3 / 4
/** Chrome around the photo — never used as the photo canvas itself. */
const LIGHTBOX_SURFACE_CLASS = "bg-[#f3f4f6] dark:bg-muted"
const PHOTO_LAYER =
  "bg-transparent select-none object-contain object-center backface-hidden transform-gpu [-webkit-user-drag:none] [-webkit-touch-callout:default]"

function markPaintedAfterDecode(img: HTMLImageElement | null, mark: () => void): void {
  if (!img || !img.complete || img.naturalWidth === 0) return
  const finish = () => mark()
  if (typeof img.decode === "function") {
    void img.decode().then(finish).catch(finish)
    return
  }
  finish()
}
/** Mobile: a little larger than contain, well short of full cover, so edges stay mostly visible. */
const MOBILE_OVERSCAN_CLASS = "origin-top object-top scale-[1.12]"

const LIGHTBOX_IMAGE_SIZES =
  "(max-width: 768px) 100vw, (max-width: 1280px) 70vw, 60vw"

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

interface LightboxSlideProps {
  src: string
  /** Browse/tile URL — paint immediately when the feed image is already cached. */
  previewSrc?: string
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
  previewSrc = "",
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
  const placeholderSrc = useMemo(
    () => (src && src !== "/placeholder.svg" ? withListingMediaPdpVariant(src) : ""),
    [src],
  )
  const initialUnderlay =
    (src && src !== "/placeholder.svg" ? withListingMediaPdpVariant(src) : "") ||
    (previewSrc && previewSrc !== src ? previewSrc : "")
  const [loadedSrc, setLoadedSrc] = useState<string | null>(() =>
    listingPhotoIsCached(src) ? src : null,
  )
  const [placeholderLoaded, setPlaceholderLoaded] = useState(() =>
    listingPhotoIsCached(initialUnderlay),
  )
  const [trackedSrc, setTrackedSrc] = useState(src)
  if (src !== trackedSrc) {
    setTrackedSrc(src)
    setLoadedSrc(null)
    setPlaceholderLoaded(false)
  }
  const [aspectRatio, setAspectRatio] = useState(initialAspectRatio)
  const pinchRef = useRef<ReactZoomPanPinchContentRef | null>(null)

  const setPinchRef = useCallback(
    (node: ReactZoomPanPinchContentRef | null) => {
      pinchRef.current = node
      registerPinchRef(slideIndex, node)
    },
    [registerPinchRef, slideIndex],
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

  const underlaySrc = placeholderSrc || (previewSrc && previewSrc !== src ? previewSrc : "")
  const slideReady = loadedSrc === src || placeholderLoaded
  const backdropSrc = underlaySrc || (src && src !== "/placeholder.svg" ? src : "")
  const [scale, setScale] = useState(1)
  const isZoomedOut = scale <= 1 + ZOOM_TOLERANCE
  const scaleRef = useRef(1)
  scaleRef.current = scale
  useEffect(() => {
    if (!isActive || isMaxMd) return
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

  const fitCard = !isMaxMd
  const frameStyle: CSSProperties | undefined = fitCard
    ? {
        aspectRatio,
        width: `min(100cqi, calc(100cqh * ${aspectRatio}))`,
        height: `min(100cqh, calc(100cqi / ${aspectRatio}))`,
      }
    : undefined

  return (
    <div
      className={cn(
        "flex h-full w-full justify-center",
        fitCard ? "[container-type:size] items-center px-16 py-10" : "items-start",
      )}
      onClick={(event) => {
        if (event.target === event.currentTarget) onBackdropClick()
      }}
    >
      <div
        className={cn(
          "relative overflow-hidden backface-hidden transform-gpu",
          !backdropSrc && LIGHTBOX_SURFACE_CLASS,
          fitCard
            ? "rounded-2xl shadow-sm ring-1 ring-black/[0.06] dark:ring-white/[0.06]"
            : "h-full w-full",
        )}
        style={{
          ...listingPhotoBackdropStyle(backdropSrc, "contain"),
          ...frameStyle,
        }}
        onClick={(event) => event.stopPropagation()}
      >
        {underlaySrc ? (
          <Image
            key={`underlay-${underlaySrc}`}
            aria-hidden
            src={underlaySrc}
            alt=""
            fill
            unoptimized={listingImageShouldBypassOptimization(underlaySrc)}
            draggable={false}
            onDragStart={preventNativeListingImageDrag}
            className={cn(
              PHOTO_LAYER,
              "pointer-events-none z-[1]",
              !fitCard && MOBILE_OVERSCAN_CLASS,
              placeholderLoaded ? "opacity-100" : "opacity-0",
            )}
            sizes={LIGHTBOX_IMAGE_SIZES}
            priority={priority}
            ref={(img) => markPaintedAfterDecode(img, () => setPlaceholderLoaded(true))}
            onLoad={(event) => {
              const img = event.currentTarget
              markPaintedAfterDecode(img, () => {
                setPlaceholderLoaded(true)
                rememberAspectRatio(img.naturalWidth, img.naturalHeight)
              })
            }}
          />
        ) : null}
        {!slideReady ? (
          <ListingTileShimmer
            aria-hidden
            className="listing-tile-shimmer-overlay absolute inset-0 z-[3] rounded-none"
          />
        ) : null}
        <div className="absolute inset-0 z-[2]">
        <TransformWrapper
          ref={setPinchRef}
          disabled={!isActive}
          initialScale={1}
          minScale={1}
          maxScale={5}
          centerOnInit={!isMaxMd}
          centerZoomedOut={!isMaxMd}
          limitToBounds
          smooth
          wheel={{ step: 0.12, disabled: !isActive }}
          panning={{
            disabled: isZoomedOut,
            allowLeftClickPan: !isZoomedOut,
            velocityDisabled: coarsePointer,
          }}
          pinch={{
            step: 3.2,
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
            wrapperClass="!h-full !w-full !bg-transparent"
            contentClass="!relative !h-full !w-full !bg-transparent [&_img]:!pointer-events-auto"
          >
            <Image
              key={src}
              src={src}
              alt={`${title} — full size ${slideIndex + 1}`}
              fill
              unoptimized
              draggable={false}
              onDragStart={preventNativeListingImageDrag}
              className={cn(
                PHOTO_LAYER,
                "!pointer-events-auto",
                !fitCard && MOBILE_OVERSCAN_CLASS,
                placeholderLoaded && loadedSrc !== src
                  ? "transition-opacity duration-200 ease-out"
                  : null,
                loadedSrc === src ? "opacity-100" : "opacity-0",
              )}
              sizes={LIGHTBOX_IMAGE_SIZES}
              priority={priority}
              onLoad={(event) => {
                const img = event.currentTarget
                markPaintedAfterDecode(img, () => {
                  setLoadedSrc(src)
                  setPlaceholderLoaded(true)
                  rememberAspectRatio(img.naturalWidth, img.naturalHeight)
                  if (isActive && !isMaxMd) {
                    requestAnimationFrame(() => {
                      pinchRef.current?.centerView(1, 0)
                    })
                  }
                })
              }}
            />
          </TransformComponent>
        </TransformWrapper>
        </div>
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
  /** Length × width × thickness · volume — shown above the thumbnail slider. */
  dimensionsLine?: string | null
  /** Browse/tile URLs aligned with `proxiedUrls` — first paint when already cached. */
  previewUrls?: string[]
}

export function ListingImageLightbox({
  open,
  onOpenChange,
  proxiedUrls,
  title,
  index,
  onIndexChange,
  aspectRatios,
  dimensionsLine,
  previewUrls,
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

  /** Freeze Embla startIndex on open. Passing the live index re-inits mid-swipe and kills drag. */
  const emblaStartIndexRef = useRef(index)
  const wasOpenRef = useRef(open)
  if (open && !wasOpenRef.current) {
    emblaStartIndexRef.current = index
  }
  wasOpenRef.current = open

  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: count > 1,
    startIndex: emblaStartIndexRef.current,
    align: "start",
    duration: 22,
    dragThreshold: 8,
    watchDrag: useSwipeCarousel ? () => isZoomedOutRef.current : false,
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
    if (!open) return
    for (const url of proxiedUrls) {
      if (!url || url === "/placeholder.svg") continue
      const full = new window.Image()
      full.decoding = "async"
      full.src = url
      const pdp = withListingMediaPdpVariant(url)
      if (pdp !== url) {
        const mid = new window.Image()
        mid.decoding = "async"
        mid.src = pdp
      }
    }
  }, [open, proxiedUrls])

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

  const renderSlide = (slideIndex: number, priority: boolean) => {
    const src = proxiedUrls[slideIndex]
    if (!src) return null
    return (
      <LightboxSlide
        src={src}
        previewSrc={previewUrls?.[slideIndex]}
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
        <DialogOverlay
          className={cn(
            "z-[70] touch-none data-[state=open]:!animate-none data-[state=closed]:duration-200",
            LIGHTBOX_SURFACE_CLASS,
          )}
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
            "fixed inset-x-0 top-0 z-[70] flex h-dvh max-h-dvh min-h-0 min-w-0 flex-col overflow-hidden outline-none",
            LIGHTBOX_SURFACE_CLASS,
            "data-[state=open]:!animate-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:duration-200",
          )}
        >
          <DialogTitle className="sr-only">
            {title} — photo {index + 1} of {Math.max(count, 1)}
          </DialogTitle>

          <div className="relative min-h-0 min-w-0 flex-1">
            {count > 0 ? (
              useSwipeCarousel ? (
                <div ref={emblaRef} className="absolute inset-0 overflow-hidden overscroll-x-contain">
                  <div className="flex h-full touch-pan-y will-change-transform">
                    {proxiedUrls.map((url, slideIndex) => (
                      <div
                        key={`${url}-${slideIndex}`}
                        className="relative h-full min-w-0 shrink-0 grow-0 basis-full backface-hidden transform-gpu"
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

            <DialogClose asChild>
              <Button
                type="button"
                size="icon"
                variant="secondary"
                className={cn(
                  "pointer-events-auto absolute right-3 z-30",
                  "top-[max(env(safe-area-inset-top),0.75rem)]",
                  CHROME_BUTTON_CLASS,
                )}
              >
                <X className="stroke-[2]" />
                <span className="sr-only">Close</span>
              </Button>
            </DialogClose>

          </div>

          {count > 1 || dimensionsLine ? (
            <div className={cn("relative z-30 flex shrink-0 flex-col gap-2 border-t border-border/40 px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-2 md:px-2", LIGHTBOX_SURFACE_CLASS)}>
              {dimensionsLine ? (
                <p className="text-center font-sans text-[15px] font-medium tabular-nums leading-snug text-foreground">
                  {dimensionsLine}
                </p>
              ) : null}
              {count > 1 ? (
                <div className="flex items-center gap-2">
                  <ListingImageCarouselNavButton
                    direction="prev"
                    variant="chrome"
                    staticPosition
                    srLabel="Previous photo"
                    onClick={goPrev}
                  />
                  <LightboxThumbRow
                    urls={proxiedUrls}
                    title={title}
                    selectedIndex={index}
                    onSelect={(next) => {
                      if (emblaApi && useSwipeCarousel) {
                        emblaApi.scrollTo(next)
                        return
                      }
                      pinchRefs.current.get(index)?.resetTransform(0)
                      setScale(1)
                      onIndexChange(next)
                    }}
                  />
                  <ListingImageCarouselNavButton
                    direction="next"
                    variant="chrome"
                    staticPosition
                    srLabel="Next photo"
                    onClick={goNext}
                  />
                </div>
              ) : null}
            </div>
          ) : (
            <div className="h-[env(safe-area-inset-bottom)] shrink-0" />
          )}
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  )
}

function LightboxThumbRow({
  urls,
  title,
  selectedIndex,
  onSelect,
}: {
  urls: string[]
  title: string
  selectedIndex: number
  onSelect: (index: number) => void
}) {
  const rowRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const row = rowRef.current
    if (!row) return
    const active = row.querySelector<HTMLElement>(`[data-lightbox-thumb="${selectedIndex}"]`)
    if (!active) return
    const rowRect = row.getBoundingClientRect()
    const thumbRect = active.getBoundingClientRect()
    if (thumbRect.left >= rowRect.left && thumbRect.right <= rowRect.right) return
    const nextLeft =
      row.scrollLeft + (thumbRect.left - rowRect.left) - (rowRect.width - thumbRect.width) / 2
    row.scrollTo({ left: Math.max(0, nextLeft), behavior: "smooth" })
  }, [selectedIndex])

  return (
    <div className="min-w-0 flex-1">
      <div
        ref={rowRef}
        className="flex justify-start snap-x snap-mandatory gap-1.5 overflow-x-auto overscroll-x-contain pb-1 md:justify-center [-ms-overflow-style:none] [scrollbar-width:none] [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden"
      >
        {urls.map((url, thumbIndex) => {
          const src = url && url !== "/placeholder.svg" ? withListingMediaPdpVariant(url) : url
          const selected = thumbIndex === selectedIndex
          return (
            <button
              key={`${url}-${thumbIndex}`}
              type="button"
              data-lightbox-thumb={thumbIndex}
              onClick={() => onSelect(thumbIndex)}
              aria-label={`Show photo ${thumbIndex + 1}`}
              aria-current={selected ? "true" : undefined}
              className={cn(
                "shrink-0 snap-center overflow-hidden rounded-lg bg-muted transition-[box-shadow,ring-color] duration-200",
                selected
                  ? "ring-[1.5px] ring-offset-2 ring-offset-background ring-foreground/80"
                  : "ring-[0.5px] ring-muted-foreground/25",
              )}
            >
              <span className="listing-tile-shimmer relative block w-11 shrink-0" style={{ paddingBottom: "133.33%" }}>
                <span className="absolute inset-0">
                  <Image
                    src={src || "/placeholder.svg"}
                    alt={`${title} — thumbnail ${thumbIndex + 1}`}
                    fill
                    unoptimized={listingImageShouldBypassOptimization(src)}
                    className="object-cover object-center"
                    sizes="44px"
                  />
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
