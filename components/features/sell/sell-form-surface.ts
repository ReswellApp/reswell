/**
 * Shared contrast tokens for /sell listing forms.
 * Palette-only: lightgray ground, white cards, listingHeart for progress/complete.
 *
 * Scale bias: roomy Reverb-like density — taller controls, airy section titles,
 * generous card padding. Avoid cramming fields into tight stacks.
 */

/**
 * Page canvas behind section cards.
 * Near-white `muted` — a whisper of cool tint so white cards separate via hairlines,
 * not heavy contrast. Sleek/minimal: depth comes from borders, not shadows.
 */
export const SELL_PAGE_GROUND_CLASS = "bg-muted"

/** Section card plane: white surface, soft edge, whisper of elevation. */
export const SELL_SECTION_CARD_CLASS =
  "rounded-2xl border-border bg-white shadow-surface"

/** Blurb under section titles — secondary but readable. */
export const SELL_SECTION_DESCRIPTION_CLASS =
  "mt-2 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-[17px]"

/** Field labels — full-contrast and readable so each question is instantly scannable. */
export const SELL_FIELD_LABEL_CLASS = "text-[15px] font-medium text-foreground"

/** Helper / hint copy under fields — quiet, with relaxed leading. */
export const SELL_FIELD_HINT_CLASS = "leading-relaxed text-muted-foreground"

/** Taller, softer inputs & selects; brand-blue focus so attention lands where you type. */
export const SELL_CONTROL_CLASS =
  "h-14 rounded-xl border-input bg-card text-base shadow-sm placeholder:text-muted-foreground focus-visible:ring-listingHeart focus-visible:border-listingHeart/50"

/** Textareas on sell forms. */
export const SELL_TEXTAREA_CLASS =
  "min-h-[9rem] rounded-xl border-input bg-card text-base shadow-sm placeholder:text-muted-foreground focus-visible:ring-listingHeart focus-visible:border-listingHeart/50"

/** Primary action (Next / Publish) — brand blue so the action color matches the progress color. */
export const SELL_PRIMARY_BUTTON_CLASS =
  "h-12 bg-listingHeart px-6 text-base text-white hover:bg-listingHeart/90 focus-visible:ring-listingHeart"

/** Complete / ready pill — uses brand `listingHeart`, not generic green. */
export const SELL_COMPLETE_BADGE_CLASS =
  "inline-flex items-center gap-1.5 rounded-full bg-listingHeart/10 px-3 py-1.5 text-xs font-medium text-listingHeart ring-1 ring-inset ring-listingHeart/25"
