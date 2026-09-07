'use client'

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'

export type WorkspaceCorner = 'nw' | 'ne' | 'sw' | 'se'

export interface WorkspaceRect {
  left: number
  top: number
  width: number
  height: number
}

const STORAGE_KEY = 'reswell-tickets-workspace'
const MIN_WIDTH = 560
const MIN_HEIGHT = 420
const VIEWPORT_PAD = 16

function clampRect(rect: WorkspaceRect): WorkspaceRect {
  const maxWidth = Math.max(MIN_WIDTH, window.innerWidth - VIEWPORT_PAD * 2)
  const maxHeight = Math.max(MIN_HEIGHT, window.innerHeight - VIEWPORT_PAD * 2)
  const width = Math.min(maxWidth, Math.max(MIN_WIDTH, rect.width))
  const height = Math.min(maxHeight, Math.max(MIN_HEIGHT, rect.height))
  const left = Math.min(
    window.innerWidth - VIEWPORT_PAD - width,
    Math.max(VIEWPORT_PAD, rect.left),
  )
  const top = Math.min(
    window.innerHeight - VIEWPORT_PAD - height,
    Math.max(VIEWPORT_PAD, rect.top),
  )
  return { left, top, width, height }
}

function readStoredRect(): WorkspaceRect | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !('left' in parsed) ||
      !('top' in parsed) ||
      !('width' in parsed) ||
      !('height' in parsed)
    ) {
      return null
    }
    const value = parsed as WorkspaceRect
    if (
      [value.left, value.top, value.width, value.height].some(
        (n) => typeof n !== 'number' || Number.isNaN(n),
      )
    ) {
      return null
    }
    return value
  } catch {
    return null
  }
}

export function useResizableWorkspace() {
  const frameRef = useRef<HTMLDivElement>(null)
  const [rect, setRect] = useState<WorkspaceRect | null>(null)
  const dragRef = useRef<{
    corner: WorkspaceCorner
    startX: number
    startY: number
    origin: WorkspaceRect
  } | null>(null)

  useEffect(() => {
    const stored = readStoredRect()
    if (stored) setRect(clampRect(stored))
  }, [])

  useEffect(() => {
    if (!rect) {
      localStorage.removeItem(STORAGE_KEY)
      return
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rect))
  }, [rect])

  const measureDefault = useCallback((): WorkspaceRect => {
    const node = frameRef.current
    if (!node) {
      return {
        left: VIEWPORT_PAD,
        top: VIEWPORT_PAD,
        width: Math.max(MIN_WIDTH, window.innerWidth - VIEWPORT_PAD * 2),
        height: Math.max(MIN_HEIGHT, window.innerHeight - VIEWPORT_PAD * 2),
      }
    }
    const box = node.getBoundingClientRect()
    return clampRect({
      left: box.left,
      top: box.top,
      width: box.width,
      height: box.height,
    })
  }, [])

  const onPointerMove = useCallback((event: PointerEvent) => {
    const drag = dragRef.current
    if (!drag) return
    const dx = event.clientX - drag.startX
    const dy = event.clientY - drag.startY
    const next = { ...drag.origin }

    if (drag.corner.includes('e')) next.width = drag.origin.width + dx
    if (drag.corner.includes('s')) next.height = drag.origin.height + dy
    if (drag.corner.includes('w')) {
      next.left = drag.origin.left + dx
      next.width = drag.origin.width - dx
    }
    if (drag.corner.includes('n')) {
      next.top = drag.origin.top + dy
      next.height = drag.origin.height - dy
    }

    setRect(clampRect(next))
  }, [])

  const stopDrag = useCallback(() => {
    dragRef.current = null
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', stopDrag)
  }, [onPointerMove])

  const startResize = useCallback(
    (corner: WorkspaceCorner, event: ReactPointerEvent<HTMLButtonElement>) => {
      event.preventDefault()
      const origin = rect ?? measureDefault()
      if (!rect) setRect(origin)
      dragRef.current = {
        corner,
        startX: event.clientX,
        startY: event.clientY,
        origin,
      }
      document.body.style.cursor = cursorForCorner(corner)
      document.body.style.userSelect = 'none'
      window.addEventListener('pointermove', onPointerMove)
      window.addEventListener('pointerup', stopDrag)
    },
    [measureDefault, onPointerMove, rect, stopDrag],
  )

  const reset = useCallback(() => {
    setRect(null)
  }, [])

  useEffect(() => () => stopDrag(), [stopDrag])

  return { frameRef, rect, startResize, reset }
}

function cursorForCorner(corner: WorkspaceCorner): string {
  if (corner === 'nw' || corner === 'se') return 'nwse-resize'
  return 'nesw-resize'
}
