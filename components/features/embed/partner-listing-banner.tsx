"use client"

import { useCallback, useEffect, useRef } from "react"
import reswellLogoPng from "@/public/images/reswell-logo.png"
import type { PartnerEmbedPublicPayload } from "@/lib/db/partner-listing-embeds"

const VECTOR_SRC = "/images/reswell-logo.svg"
const VECTOR_FIRST = process.env.NEXT_PUBLIC_SITE_WORDMARK_USE_VECTOR_SVG === "true"
const PNG_SRC = typeof reswellLogoPng !== "string" ? reswellLogoPng.src : reswellLogoPng
const PNG_WIDTH = typeof reswellLogoPng !== "string" ? reswellLogoPng.width : undefined
const PNG_HEIGHT = typeof reswellLogoPng !== "string" ? reswellLogoPng.height : undefined

function PartnerEmbedWordmark({ href }: { href: string }) {
  const swappedRef = useRef(false)

  const onRasterFallback = useCallback((event: { currentTarget: HTMLImageElement }) => {
    if (swappedRef.current) return
    swappedRef.current = true
    const el = event.currentTarget
    el.src = PNG_SRC
    if (!el.width) el.width = PNG_WIDTH ?? 996
    if (!el.height) el.height = PNG_HEIGHT ?? 137
  }, [])

  return (
    <a
      href={href}
      target="_top"
      rel="noopener sponsored"
      className="inline-flex shrink-0 items-center"
      aria-label="Reswell"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={VECTOR_FIRST ? VECTOR_SRC : PNG_SRC}
        alt="Reswell"
        width={PNG_WIDTH}
        height={PNG_HEIGHT}
        className="h-auto max-h-[1.35rem] w-auto max-w-[4.75rem] object-contain object-left sm:max-h-[1.5rem] sm:max-w-[5.25rem]"
        decoding="async"
        onError={VECTOR_FIRST ? onRasterFallback : undefined}
      />
    </a>
  )
}

export function PartnerListingEmbedResize({
  slug,
  origin,
  containerRef,
}: {
  slug: string
  origin: string
  containerRef: React.RefObject<HTMLElement | null>
}) {
  useEffect(() => {
    function postHeight() {
      const el = containerRef.current
      if (!el || typeof window === "undefined") return
      const height = Math.ceil(el.getBoundingClientRect().height)
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: "reswell-embed-resize", slug, height }, origin)
      }
    }

    postHeight()
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(postHeight) : null
    if (observer && containerRef.current) observer.observe(containerRef.current)
    window.addEventListener("resize", postHeight)
    return () => {
      observer?.disconnect()
      window.removeEventListener("resize", postHeight)
    }
  }, [slug, origin, containerRef])

  return null
}

export function PartnerListingBannerClient({
  payload,
  containerRef,
}: {
  payload: PartnerEmbedPublicPayload
  containerRef: React.RefObject<HTMLDivElement | null>
}) {
  const listings = payload.listings.slice(0, 4)

  return (
    <div ref={containerRef} className="mx-auto w-full max-w-[920px] px-3 py-3 sm:px-4">
      <div className="flex flex-col gap-3 rounded-sm border border-neutral-300 bg-[#fafafa] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] sm:flex-row sm:items-stretch sm:gap-4 sm:p-4">
        <div className="min-w-0 flex-1 sm:max-w-[34%]">
          <PartnerEmbedWordmark href={payload.browse_href} />
          <p className="mt-2 font-headline text-[1.35rem] font-bold leading-tight tracking-[-0.02em] text-neutral-950 sm:mt-2.5 sm:text-[1.5rem]">
            {payload.headline}
          </p>
          <p className="mt-1 text-sm leading-snug text-neutral-600">{payload.subheadline}</p>
        </div>

        <div className="flex min-w-0 flex-[1.4] items-center">
          {listings.length === 0 ? (
            <p className="rounded border border-dashed border-neutral-300 bg-white/70 px-3 py-4 text-center text-xs text-neutral-500">
              No active listings in this feed yet.
            </p>
          ) : (
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-2.5">
              {listings.map((listing) => (
                <li key={listing.id} className="min-w-0">
                  <a
                    href={listing.href}
                    target="_top"
                    rel="noopener sponsored"
                    className="group block overflow-hidden rounded border border-neutral-200 bg-white transition hover:border-neutral-400"
                  >
                    <div className="relative aspect-[3/4] w-full overflow-hidden bg-neutral-100">
                      {listing.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={listing.image_url}
                          alt=""
                          className="block h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[10px] text-neutral-400">
                          No photo
                        </div>
                      )}
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex shrink-0 items-center sm:w-[168px] sm:justify-end">
          <a
            href={payload.browse_href}
            target="_top"
            rel="noopener sponsored"
            className="flex w-full flex-col items-center justify-center rounded-sm bg-[#0b1f3a] px-4 py-3 text-center text-white transition hover:bg-[#102a4d] sm:min-h-[108px]"
          >
            <span className="text-[11px] font-bold uppercase tracking-[0.08em] leading-tight">
              {payload.cta_primary}
            </span>
            <span className="mt-1 text-xs font-normal text-white/90">{payload.cta_secondary}</span>
          </a>
        </div>
      </div>
    </div>
  )
}
