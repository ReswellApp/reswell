/** Shared sizing tokens aligned with /messages account pages. */
export const dashboardPageTitleClass =
  "text-2xl font-semibold tracking-tight text-foreground sm:text-[28px]"

export const dashboardPageSubtitleClass =
  "mt-1 text-[14px] leading-snug text-muted-foreground sm:text-[15px]"

/** Section heading below the mobile account dropdown (Pango-style). */
export const dashboardMobileSectionTitleClass =
  "text-lg font-semibold tracking-tight text-foreground sm:text-xl"

/** Fixed send bar docked to the viewport bottom on mobile message threads. */
export const messageThreadMobileComposerDockClass =
  "max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-50 max-lg:border-t max-lg:border-border/60 max-lg:bg-background/95 max-lg:px-3 max-lg:pt-2 max-lg:pb-[max(0.5rem,env(safe-area-inset-bottom))] max-lg:backdrop-blur-sm supports-[backdrop-filter]:max-lg:bg-background/85"

/** In-flow spacer matching the fixed mobile composer height (keeps page scroll height). */
export const messageThreadMobileComposerSpacerClass =
  "max-lg:h-[calc(4.75rem+env(safe-area-inset-bottom))] max-lg:shrink-0 lg:hidden"

/** Pill-shaped message composer shell — cerulean outline when the textarea is focused. */
export const messageComposerBarClass =
  "flex items-end gap-2 rounded-[24px] border border-border/70 bg-background/95 px-2 py-1.5 shadow-[0_2px_16px_rgba(17,17,17,0.06)] backdrop-blur-sm transition-[border-color,box-shadow] focus-within:border-cerulean focus-within:ring-2 focus-within:ring-cerulean/20 dark:border-border/80 dark:bg-card/95 dark:shadow-none dark:focus-within:border-cerulean/70"

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

export const dashboardSidebarNavItemClass =
  "flex items-center gap-4 rounded-xl px-4 py-3 text-base font-semibold transition-colors"

export const dashboardSidebarNavIconClass = "h-5 w-5 shrink-0"

export const dashboardSidebarCreateButtonClass = "h-12 w-full rounded-xl text-base font-semibold"
