'use client'

import { useEffect } from 'react'

const LOCK_ATTR = 'data-reswell-scroll-lock'

type BodyScrollLockSnapshot = {
  htmlOverflow: string
  htmlOverscroll: string
  bodyOverflow: string
  bodyOverscroll: string
  bodyPosition: string
  bodyTop: string
  bodyWidth: string
  scrollY: number
}

let activeLockCount = 0
let appliedSnapshot: BodyScrollLockSnapshot | null = null

function readLockedScrollY(): number {
  if (typeof document === 'undefined') return 0
  const top = document.body.style.top
  if (top.startsWith('-')) {
    const parsed = Number.parseInt(top.slice(1), 10)
    if (Number.isFinite(parsed)) return parsed
  }
  return window.scrollY
}

function clearInlineScrollLockStyles(): number {
  if (typeof document === 'undefined') return 0

  const scrollY = readLockedScrollY()
  const html = document.documentElement
  const body = document.body

  html.style.overflow = ''
  html.style.overscrollBehavior = ''
  body.style.overflow = ''
  body.style.overscrollBehavior = ''
  body.style.position = ''
  body.style.top = ''
  body.style.width = ''
  body.style.paddingRight = ''
  body.style.marginRight = ''
  // react-remove-scroll sets this inline. Leaving it after a dialog unmounts
  // makes every tap on the page a no-op.
  body.style.pointerEvents = ''
  body.removeAttribute('data-scroll-locked')
  html.removeAttribute(LOCK_ATTR)

  return scrollY
}

function applyBodyScrollLock(): BodyScrollLockSnapshot {
  const scrollY = window.scrollY
  const html = document.documentElement
  const body = document.body

  const snapshot: BodyScrollLockSnapshot = {
    htmlOverflow: html.style.overflow,
    htmlOverscroll: html.style.overscrollBehavior,
    bodyOverflow: body.style.overflow,
    bodyOverscroll: body.style.overscrollBehavior,
    bodyPosition: body.style.position,
    bodyTop: body.style.top,
    bodyWidth: body.style.width,
    scrollY,
  }

  // Do not use `position: fixed` on `body` — it shifts the entire document (including
  // the sticky site header) above the viewport and leaves the page "frozen" if cleanup fails.
  // Do not set `overflow: hidden` on `html` for touch screens. With the body lock, WebKit
  // then ignores taps on fixed UI (menu, dialogs) and the phone is stuck.
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches
  html.setAttribute(LOCK_ATTR, '')
  if (!coarsePointer) html.style.overflow = 'hidden'
  html.style.overscrollBehavior = 'none'
  body.style.overflow = 'hidden'
  body.style.overscrollBehavior = 'none'

  return snapshot
}

function restoreBodyScrollLock(snapshot: BodyScrollLockSnapshot | null): void {
  if (typeof document === 'undefined') return

  if (snapshot) {
    const html = document.documentElement
    const body = document.body

    html.style.overflow = snapshot.htmlOverflow
    html.style.overscrollBehavior = snapshot.htmlOverscroll
    body.style.overflow = snapshot.bodyOverflow
    body.style.overscrollBehavior = snapshot.bodyOverscroll
    body.style.position = snapshot.bodyPosition
    body.style.top = snapshot.bodyTop
    body.style.width = snapshot.bodyWidth
    html.removeAttribute(LOCK_ATTR)
    window.scrollTo(0, snapshot.scrollY)
    return
  }

  const scrollY = clearInlineScrollLockStyles()
  window.scrollTo(0, scrollY)
}

/** Safety valve when a drawer unmounts mid-navigation or scroll-lock refs desync. */
export function forceReleaseBodyScrollLock(): void {
  if (typeof document === 'undefined') return
  const scrollY = appliedSnapshot?.scrollY ?? readLockedScrollY()
  activeLockCount = 0
  appliedSnapshot = null
  clearInlineScrollLockStyles()
  window.scrollTo(0, scrollY)
}

/**
 * Disables page scroll while `locked` is true. Used for full-screen overlays that
 * are not Radix Dialog (which uses react-remove-scroll).
 */
export function useBodyScrollLock(locked: boolean): void {
  useEffect(() => {
    if (!locked || typeof document === 'undefined') return

    activeLockCount += 1
    if (activeLockCount === 1) {
      appliedSnapshot = applyBodyScrollLock()
    }

    return () => {
      activeLockCount = Math.max(0, activeLockCount - 1)
      if (activeLockCount === 0) {
        restoreBodyScrollLock(appliedSnapshot)
        appliedSnapshot = null
      }
    }
  }, [locked])
}
