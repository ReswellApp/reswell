/** Shared Tailwind classes for the live chat widget shell. */
export const liveChatShellClass =
  "flex h-[min(640px,calc(100dvh-6.5rem))] w-[min(100vw-1.5rem,400px)] flex-col overflow-hidden rounded-3xl border border-border/50 bg-background shadow-[0_24px_64px_rgba(15,23,42,0.18)]"

export const liveChatCardClass =
  "overflow-hidden rounded-2xl border border-border/50 bg-card shadow-sm transition-colors"

export const liveChatCardButtonClass =
  "flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-muted/60"

export const liveChatThreadSurfaceClass = "flex-1 space-y-3 overflow-y-auto bg-muted/25 px-3 py-4"
