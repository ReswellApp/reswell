import { cn } from "@/lib/utils"

export function AuthFormOrDivider({ className }: { className?: string }) {
  return (
    <div className={cn("relative py-1", className)}>
      <div className="absolute inset-0 flex items-center" aria-hidden>
        <div className="w-full border-t border-border" />
      </div>
      <div className="relative flex justify-center">
        <span className="bg-background px-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Or
        </span>
      </div>
    </div>
  )
}
