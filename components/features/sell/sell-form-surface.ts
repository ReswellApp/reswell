/**
 * Shared contrast tokens for /sell listing forms.
 * Palette-only: lightgray ground, white cards, listingHeart for progress/complete.
 */

/**
 * Page canvas behind section cards.
 * Near-white `muted` — a whisper of cool tint so white cards separate via hairlines,
 * not heavy contrast. Sleek/minimal: depth comes from borders, not shadows.
 */
export const SELL_PAGE_GROUND_CLASS = "bg-muted"

/** Section card plane: white surface, hairline edge, whisper of elevation, soft corners. */
export const SELL_SECTION_CARD_CLASS =
  "rounded-xl border-border bg-white shadow-surface"

/** Blurb under section titles — secondary but readable (no ultra-low opacity). */
export const SELL_SECTION_DESCRIPTION_CLASS =
  "mt-1 text-sm leading-relaxed text-muted-foreground lg:mt-1.5 lg:text-base"

/** Field labels — full-contrast and readable so each question is instantly scannable. */
export const SELL_FIELD_LABEL_CLASS = "text-sm font-medium text-foreground"

/** Helper / hint copy under fields — quiet, with relaxed leading. */
export const SELL_FIELD_HINT_CLASS = "leading-relaxed text-muted-foreground"

/** Taller, softer inputs & selects; brand-blue focus so attention lands where you type. */
export const SELL_CONTROL_CLASS =
  "h-12 rounded-lg border-input bg-card shadow-sm placeholder:text-muted-foreground focus-visible:ring-listingHeart focus-visible:border-listingHeart/50"

/** Textareas on sell forms. */
export const SELL_TEXTAREA_CLASS =
  "min-h-[7rem] rounded-lg border-input bg-card shadow-sm placeholder:text-muted-foreground focus-visible:ring-listingHeart focus-visible:border-listingHeart/50"

/** Complete / ready pill — uses brand `listingHeart`, not generic green. */
export const SELL_COMPLETE_BADGE_CLASS =
  "inline-flex items-center gap-1.5 rounded-full bg-listingHeart/10 px-2.5 py-1 text-xs font-medium text-listingHeart ring-1 ring-inset ring-listingHeart/25"
