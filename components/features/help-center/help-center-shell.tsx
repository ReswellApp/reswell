import { HelpCenterBackBar } from "@/components/features/help-center/help-center-back-bar"
import { HelpCenterHeader } from "@/components/features/help-center/help-center-header"
import { HelpCenterSearch } from "@/components/features/help-center/help-center-search"

type HelpCenterShellProps = {
  children: React.ReactNode
  showSearch?: boolean
  searchCompact?: boolean
}

export function HelpCenterShell({
  children,
  showSearch = false,
  searchCompact = true,
}: HelpCenterShellProps) {
  return (
    <div className="min-h-dvh bg-white text-neutral-900">
      <HelpCenterBackBar />
      <HelpCenterHeader />
      {showSearch ? (
        <div className="relative border-b border-neutral-200 bg-neutral-50 px-4 py-6 sm:px-6">
          <div className="relative mx-auto max-w-3xl">
            <HelpCenterSearch inputId="help-center-search-inner" compact={searchCompact} />
          </div>
        </div>
      ) : null}
      {children}
    </div>
  )
}
