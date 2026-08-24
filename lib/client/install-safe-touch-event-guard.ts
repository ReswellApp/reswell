declare global {
  interface Window {
    __reswellSafeTouchEventGuardInstalled?: boolean
  }
}

function touchEventMissingClientPoint(event: Event): boolean {
  if (!("changedTouches" in event)) return false
  const point = (event as TouchEvent).changedTouches?.[0]
  return point == null
}

/**
 * iOS Safari (and some synthetic `dispatchEvent` TouchEvents) can fire touch
 * start/move/end with `changedTouches` present but empty. Radix Dialog's
 * `react-remove-scroll` then evaluates `e.changedTouches[0].clientX` and
 * throws. Drop those events in capture before any library handler runs.
 */
export function installSafeTouchEventGuard(): void {
  if (typeof window === "undefined") return
  if (window.__reswellSafeTouchEventGuardInstalled) return
  window.__reswellSafeTouchEventGuardInstalled = true

  const options: AddEventListenerOptions = { capture: true, passive: true }
  const swallow = (event: Event) => {
    if (!touchEventMissingClientPoint(event)) return
    event.stopImmediatePropagation()
  }

  window.addEventListener("touchstart", swallow, options)
  window.addEventListener("touchmove", swallow, options)
  window.addEventListener("touchend", swallow, options)
  window.addEventListener("touchcancel", swallow, options)
}
