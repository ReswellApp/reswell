import { cn } from "@/lib/utils"

interface TranslateableDescriptionProps {
  text: string
  className?: string
}

export function TranslateableDescription({ text, className }: TranslateableDescriptionProps) {
  const isEmpty = !text || text.trim() === ""

  if (isEmpty) {
    return (
      <p className={cn("break-words text-foreground", className)}>No description provided.</p>
    )
  }

  return (
    <p className={cn("break-words whitespace-pre-wrap text-foreground", className)}>{text}</p>
  )
}
