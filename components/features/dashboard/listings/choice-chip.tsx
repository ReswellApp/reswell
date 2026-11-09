import type { ButtonHTMLAttributes } from "react"
import { cn } from "@/lib/utils"

interface ChoiceChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean
}

export function ChoiceChip({
  selected = false,
  className,
  type = "button",
  ...props
}: ChoiceChipProps) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={cn(
        "inline-flex min-h-touch items-center justify-center rounded-full px-3.5 text-[13px] font-medium tracking-[-0.01em] transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/15 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:pointer-events-none disabled:opacity-50",
        selected
          ? "border border-foreground bg-foreground text-background shadow-sm dark:border-white dark:bg-white dark:text-black"
          : "border border-border/80 bg-background text-foreground hover:border-foreground/30 hover:bg-muted/70",
        className,
      )}
      {...props}
    />
  )
}
