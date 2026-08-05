/**
 * Line-art surfboard illustrations for the sell-flow photo examples banner.
 * Drawn as inline SVGs (Reverb-style) so they stay crisp and inherit palette colors.
 */

interface IconProps {
  className?: string
}

const STROKE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const

/** Full deck, straight on — the cover shot. */
export function SurfboardDeckIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden {...STROKE}>
      <path d="M24 4C15.5 12 13.5 27 24 44 34.5 27 32.5 12 24 4Z" />
      <path d="M24 8v32" strokeWidth={1.1} />
    </svg>
  )
}

/** Bottom of the board with fins. */
export function SurfboardBottomIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden {...STROKE}>
      <path d="M24 4C15.5 12 13.5 27 24 44 34.5 27 32.5 12 24 4Z" />
      <path d="M19.5 30l-3 5M28.5 30l3 5M24 33v6" strokeWidth={1.4} />
    </svg>
  )
}

/** Side profile — rails and rocker. */
export function SurfboardRailsIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden {...STROKE}>
      <path d="M4 30C12 22.5 30 20.5 44 24" />
      <path d="M6 32.5C14 26.5 30 24.5 43 27.5" />
      <path d="M4 30c.5 1.2 1.2 2 2 2.5M44 24c-.2 1.5-.6 2.6-1 3.5" />
    </svg>
  )
}

/** Tail and fin setup up close. */
export function SurfboardTailIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden {...STROKE}>
      <path d="M11 4c-1.5 14 1 30 13 40 12-10 14.5-26 13-40" />
      <path d="M17 24l-5 8M31 24l5 8M24 28v9" strokeWidth={1.4} />
    </svg>
  )
}

/** Board beside a ruler — length and scale. */
export function SurfboardScaleIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden {...STROKE}>
      <path d="M29 5c-6.5 6.5-8 18.5 0 32 8-13.5 6.5-25.5 0-32Z" />
      <path d="M12 5v32M12 5h4M12 13h3M12 21h4M12 29h3M12 37h4" strokeWidth={1.4} />
    </svg>
  )
}

/** Ding / repair area up close. */
export function SurfboardDingIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden {...STROKE}>
      <path d="M24 4C15.5 12 13.5 27 24 44 34.5 27 32.5 12 24 4Z" />
      <path d="M20 20l3 2.5-2.5 3 4 1.5-1 3.5" strokeWidth={1.4} />
    </svg>
  )
}
