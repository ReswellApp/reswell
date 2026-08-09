import { cn } from '@/lib/utils'

interface SmoothCollapseProps {
  open: boolean
  children: React.ReactNode
  className?: string
}

/**
 * Animates conditional content open/closed by transitioning CSS grid rows,
 * so surrounding layout shifts smoothly instead of jumping. Content stays
 * mounted while closed; `inert` + `aria-hidden` keep it out of the tab order
 * and accessibility tree.
 */
export function SmoothCollapse({ open, children, className }: SmoothCollapseProps) {
  return (
    <div
      className={cn(
        'grid transition-[grid-template-rows,opacity] duration-300 ease-smooth',
        open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
        className,
      )}
      aria-hidden={!open}
      inert={!open}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  )
}
