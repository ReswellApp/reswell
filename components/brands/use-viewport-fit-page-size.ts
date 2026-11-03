"use client"

import { useLayoutEffect, useState, type RefObject } from "react"
import { viewportFitPageSize } from "@/lib/brands/viewport-fit-page-size"

const RESIZE_DEBOUNCE_MS = 180
/** Ignore tiny viewport jitter (browser chrome, mobile URL bar). */
const VIEWPORT_CHANGE_THRESHOLD_PX = 48

function readRowStridePx(list: HTMLElement, fallbackItemHeight: number): number {
  const first = list.querySelector(":scope > *") as HTMLElement | null
  if (!first) return fallbackItemHeight

  const height = first.getBoundingClientRect().height
  const styles = window.getComputedStyle(list)
  const gapRaw = styles.rowGap && styles.rowGap !== "normal" ? styles.rowGap : styles.gap
  const gap = Number.parseFloat(gapRaw || "0")
  const stride = height + (Number.isFinite(gap) ? gap : 0)
  return stride > 0 ? stride : fallbackItemHeight
}

/**
 * Page size that fills the visible viewport from the list top down to the
 * pager — so Back/Next stay on screen without a long scroll.
 * Window resizes are debounced; list content resizes do not thrash page size.
 */
export function useViewportFitPageSize({
  listRef,
  columnsForWidth,
  fallbackItemHeight,
  fallbackPageSize,
  minPageSize = 4,
  maxPageSize = 40,
  pagerReservePx = 80,
  bottomPadPx = 28,
  enabled = true,
}: {
  listRef: RefObject<HTMLElement | null>
  columnsForWidth: (width: number) => number
  fallbackItemHeight: number
  fallbackPageSize: number
  minPageSize?: number
  maxPageSize?: number
  pagerReservePx?: number
  bottomPadPx?: number
  enabled?: boolean
}): number {
  const [pageSize, setPageSize] = useState(fallbackPageSize)

  useLayoutEffect(() => {
    if (!enabled) {
      setPageSize(fallbackPageSize)
      return
    }

    let frame = 0
    let debounceTimer = 0
    let lastWidth = window.innerWidth
    let lastHeight = window.innerHeight

    const measure = () => {
      const list = listRef.current
      if (!list) return

      const width = window.innerWidth
      const columns = columnsForWidth(width)
      const rowStridePx = readRowStridePx(list, fallbackItemHeight)
      const next = viewportFitPageSize({
        viewportHeight: window.innerHeight,
        listTop: list.getBoundingClientRect().top,
        rowStridePx,
        columns,
        pagerReservePx,
        bottomPadPx,
        minPageSize,
        maxPageSize,
      })
      setPageSize((prev) => (prev === next ? prev : next))
    }

    const scheduleImmediate = () => {
      window.clearTimeout(debounceTimer)
      cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(measure)
    }

    const scheduleDebounced = () => {
      const width = window.innerWidth
      const height = window.innerHeight
      const widthChanged = width !== lastWidth
      const heightDelta = Math.abs(height - lastHeight)
      if (!widthChanged && heightDelta < VIEWPORT_CHANGE_THRESHOLD_PX) return

      lastWidth = width
      lastHeight = height
      window.clearTimeout(debounceTimer)
      debounceTimer = window.setTimeout(() => {
        cancelAnimationFrame(frame)
        frame = window.requestAnimationFrame(measure)
      }, RESIZE_DEBOUNCE_MS)
    }

    scheduleImmediate()
    window.addEventListener("resize", scheduleDebounced)
    window.addEventListener("orientationchange", scheduleDebounced)

    return () => {
      cancelAnimationFrame(frame)
      window.clearTimeout(debounceTimer)
      window.removeEventListener("resize", scheduleDebounced)
      window.removeEventListener("orientationchange", scheduleDebounced)
    }
  }, [
    bottomPadPx,
    columnsForWidth,
    enabled,
    fallbackItemHeight,
    fallbackPageSize,
    listRef,
    maxPageSize,
    minPageSize,
    pagerReservePx,
  ])

  return pageSize
}
