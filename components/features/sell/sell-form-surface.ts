/**
 * Shared contrast tokens for /sell listing forms.
 * Cooler page ground + stronger cards/controls so sections read as clear work surfaces.
 */

/** Page canvas behind section cards (cooler than pure white). */
export const SELL_PAGE_GROUND_CLASS = "bg-slate-100"

/** Section card plane: stronger border + soft elevation. */
export const SELL_SECTION_CARD_CLASS =
  "border-slate-300 shadow-md ring-1 ring-slate-900/[0.05] hover:shadow-md lg:shadow-lg"

/** Blurb under section titles — secondary but readable (no ultra-low opacity). */
export const SELL_SECTION_DESCRIPTION_CLASS =
  "mt-1 text-sm text-muted-foreground lg:mt-1.5 lg:text-base"

/** Field labels — near-foreground for scanability. */
export const SELL_FIELD_LABEL_CLASS = "text-xs font-medium text-foreground/85"

/** Helper / hint copy under fields. */
export const SELL_FIELD_HINT_CLASS = "text-muted-foreground"

/** Taller, higher-contrast inputs & selects. */
export const SELL_CONTROL_CLASS =
  "h-11 border-foreground/20 bg-card shadow-sm placeholder:text-muted-foreground"

/** Textareas on sell forms. */
export const SELL_TEXTAREA_CLASS =
  "min-h-[7rem] border-foreground/20 bg-card shadow-sm placeholder:text-muted-foreground"
