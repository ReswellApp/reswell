/**
 * Shared Radix dialog shell for auth modals (login / sign-up / Google OAuth).
 * Keep overlay opacity and content sizing in sync.
 */

/** Default login / sign-up modal — matches {@link AuthModal}. */
export const AUTH_MODAL_OVERLAY_CLASS =
  "z-[100] touch-none bg-black/80"

export const AUTH_MODAL_CONTENT_CLASS =
  "z-[101] max-h-[min(92vh,780px)] w-[calc(100%-2rem)] max-w-md overflow-y-auto border-0 p-5 sm:p-6"

/** Mobile login / sign-up sheet — slides up from the bottom (Vaul). */
export const AUTH_DRAWER_CONTENT_CLASS =
  "z-[101] mt-0 max-h-[min(92vh,780px)] overflow-y-auto rounded-t-2xl border-0 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"

/** Flatten nested Card inside auth modals — dialog shell is the only surface. */
export const AUTH_MODAL_INNER_CARD_CLASS =
  "rounded-none border-0 bg-transparent p-0 shadow-none hover:shadow-none"
export const AUTH_MODAL_INNER_CARD_HEADER_CLASS = "px-0 pt-0"
export const AUTH_MODAL_INNER_CARD_CONTENT_CLASS = "px-0 pb-0 pt-0"
export const AUTH_MODAL_OR_EMAIL_LABEL_CLASS = "bg-background px-2 text-muted-foreground"
