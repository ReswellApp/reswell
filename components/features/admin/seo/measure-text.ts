/**
 * Approximate the rendered pixel width of search-snippet text, matching how Google truncates by
 * pixels rather than characters. Uses a cached canvas with Arial (Google's SERP font).
 */

let ctx: CanvasRenderingContext2D | null = null

function getCtx(): CanvasRenderingContext2D | null {
  if (typeof document === "undefined") return null
  if (ctx) return ctx
  const canvas = document.createElement("canvas")
  ctx = canvas.getContext("2d")
  return ctx
}

/** Google desktop pixel budgets. */
export const PIXEL_LIMITS = {
  title: 600,
  description: 990,
} as const

/** SSR + initial client hydration — must match on server and first client paint. */
export function approximateTextPx(text: string, fontPx: number): number {
  return Math.round(text.length * fontPx * 0.5)
}

export function measureTextPx(text: string, fontPx: number): number {
  const c = getCtx()
  if (!c) return approximateTextPx(text, fontPx)
  c.font = `${fontPx}px Arial, sans-serif`
  return Math.round(c.measureText(text).width)
}

/** Title is rendered ~20px, description ~14px in Google desktop results. */
export function titlePx(text: string): number {
  return measureTextPx(text, 20)
}

export function descriptionPx(text: string): number {
  return measureTextPx(text, 14)
}
