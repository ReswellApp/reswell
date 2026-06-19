import type { ReactNode } from "react"

interface StorePageHeaderProps {
  title: string
  description?: string
  /** Extra actions (e.g. primary button) aligned right on desktop. */
  actions?: ReactNode
}

/** Desktop page title — mobile titles come from StoreMobileChrome. */
export function StorePageHeader({ title, description, actions }: StorePageHeaderProps) {
  return (
    <header className="mb-6 hidden lg:flex lg:items-end lg:justify-between lg:gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </header>
  )
}
