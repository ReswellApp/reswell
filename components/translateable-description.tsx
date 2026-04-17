interface TranslateableDescriptionProps {
  text: string
  className?: string
}

export function TranslateableDescription({ text, className = "" }: TranslateableDescriptionProps) {
  const isEmpty = !text || text.trim() === ""

  if (isEmpty) {
    return <p className={`break-words text-muted-foreground ${className}`}>No description provided.</p>
  }

  return <p className={`break-words whitespace-pre-wrap text-muted-foreground ${className}`}>{text}</p>
}
