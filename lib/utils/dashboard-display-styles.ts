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

/** Pill-shaped input shell — cerulean outline when the textarea is focused. */
export const messageComposerInputShellClass =
  "flex min-w-0 flex-1 items-end gap-1 rounded-[24px] border border-border/70 bg-background/95 px-2 py-1.5 shadow-[0_2px_16px_rgba(17,17,17,0.06)] backdrop-blur-sm transition-[border-color,box-shadow] focus-within:border-cerulean focus-within:ring-2 focus-within:ring-cerulean/20 dark:border-border/80 dark:bg-card/95 dark:shadow-none dark:focus-within:border-cerulean/70"

/** Nested send control inside the composer input shell. */
export const messageComposerSendButtonClass =
  "mb-0.5 h-9 shrink-0 rounded-full bg-muted/80 px-4 text-[15px] font-semibold text-muted-foreground hover:bg-muted disabled:pointer-events-none disabled:opacity-40"

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

export const dashboardSidebarNavItemClass =
  "flex items-center gap-4 rounded-xl px-4 py-3 text-base font-semibold transition-colors"

export const dashboardSidebarNavIconClass = "h-5 w-5 shrink-0"

export const dashboardSidebarCreateButtonClass = "h-12 w-full rounded-xl text-base font-semibold"
