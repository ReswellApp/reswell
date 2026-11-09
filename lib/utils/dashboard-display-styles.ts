/** Shared sizing tokens aligned with /messages account pages. */
export const dashboardPageTitleClass =
  "text-2xl font-semibold tracking-tight text-foreground sm:text-[28px]"

export const dashboardPageSubtitleClass =
  "mt-1 text-[14px] leading-snug text-muted-foreground sm:text-[15px]"

/** Section heading below the mobile account dropdown (Pango-style). */
export const dashboardMobileSectionTitleClass =
  "text-lg font-semibold tracking-tight text-foreground sm:text-xl"

/** Message composer row: media button + input shell. */
export const messageComposerFormClass = "flex items-center gap-2"

/** Pill-shaped input shell — iMessage-style gray field that tightens on focus. */
export const messageComposerInputShellClass =
  "flex min-w-0 flex-1 items-end gap-1 rounded-[20px] border border-border/80 bg-muted/70 px-1.5 py-1 shadow-none transition-[border-color,background-color] focus-within:border-border focus-within:bg-background dark:border-border/70 dark:bg-muted/40 dark:focus-within:bg-card"

/** Nested send control inside the composer input shell — iMessage-style circular arrow. */
export const messageComposerSendButtonClass =
  "mb-0.5 h-8 w-8 shrink-0 rounded-full bg-listingHeart p-0 text-white hover:bg-listingHeart/90 disabled:pointer-events-none disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100"

/** @deprecated Use messageComposerFormClass + messageComposerInputShellClass */
export const messageComposerBarClass = messageComposerInputShellClass

export const dashboardSearchInputClass =
  "h-10 rounded-xl border-border/80 bg-muted/70 pl-10 text-[15px] shadow-none"

export const dashboardFilterSelectClass =
  "h-10 rounded-xl border-border/80 bg-muted/70 shadow-none sm:w-[220px]"

/** Portrait listing thumb for list rows (matches message thread header). */
export const listingPortraitThumbClass =
  "relative w-14 shrink-0 aspect-[3/4] overflow-hidden rounded-xl border border-border/60 bg-muted sm:w-[72px] lg:w-[88px]"

/** `sizes` hint for portrait listing thumbs in dashboard list rows. */
export const listingPortraitThumbSizes = "(min-width: 1024px) 88px, 72px"

/** Compact offer/listing tile width on dashboard and messages offers tabs. */
export const listingOfferTileCompactClass = "sm:w-36 lg:w-44"

/** Dashboard sidebar shell width (reference: ~20–25% of content area on desktop). */
export const dashboardSidebarWidthClass = "lg:w-72 xl:w-80 2xl:w-[22rem]"

/**
 * Sticky dashboard rail. `self-start` keeps it from stretching with a long
 * main column, `top-24` sits under the site header, and the max height lets
 * the rail scroll on its own. Without that cap, links below the fold stay
 * pinned until the page itself reaches the bottom.
 */
export const dashboardSidebarStickyScrollClass =
  "sticky top-24 self-start max-h-[calc(100dvh-7.5rem)] overflow-y-auto overscroll-y-contain pb-4 [scrollbar-width:thin]"

export const dashboardSidebarNavItemClass =
  "flex items-center gap-4 rounded-xl px-4 py-3 text-base font-semibold transition-colors"

export const dashboardSidebarNavIconClass = "h-5 w-5 shrink-0"

export const dashboardSidebarCreateButtonClass = "h-12 w-full rounded-xl text-base font-semibold"
