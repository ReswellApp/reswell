interface TranslateableDescriptionProps {
  text: string
  className?: string
}

export function TranslateableDescription({ text, className = "" }: TranslateableDescriptionProps) {
  const isEmpty = !text || text.trim() === ""

  if (isEmpty) {
    return <p className={`text-muted-foreground ${className}`}>No description provided.</p>
  }

  return <p className={`text-muted-foreground whitespace-pre-wrap ${className}`}>{text}</p>
}
