import { cn } from "@/lib/utils"

export function legalHeadingClass(compact?: boolean) {
  return cn(
    "font-semibold text-foreground",
    compact ? "mb-1.5 mt-5 text-base" : "mb-2 mt-8 text-xl",
  )
}

export function legalProseClass(compact?: boolean) {
  return cn(
    "prose prose-neutral max-w-none text-muted-foreground dark:prose-invert",
    compact ? "space-y-4 text-sm" : "space-y-6",
  )
}

export function formatLegalLastUpdated() {
  return new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}
