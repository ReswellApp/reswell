import { cn } from "@/lib/utils"

/** Basket glyph for listing tile cart / checkout controls (monochrome via `currentColor`). */
export function ListingTileBasketSvg({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("h-4 w-4 shrink-0", className)}
      aria-hidden
    >
      <path
        d="M9 8V6a3 3 0 116 0v2"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 8h16l-1.5 11a2 2 0 01-2 1.5H7.5a2 2 0 01-2-1.5L4 8z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
