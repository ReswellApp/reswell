/** Temporary seller-facing copy while platform bank transfers cannot be funded. */
export const EARNINGS_TRANSFER_PAUSE = {
  errorCode: "platform_balance_insufficient",
  bannerTitle: "Bank transfers are paused",
  bannerBody: "We’re currently working on fixing this. Hang tight — your earnings are safe.",
  toastTitle: "Hang tight — we’re fixing transfers.",
  toastDetail:
    "We’re currently working on this. Your balance is safe, and you can try again once transfers are back.",
} as const
