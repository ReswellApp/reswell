import { cn } from '@/lib/utils'
import { AdminStatCard, type AdminStatTone } from '@/components/features/admin/admin-stat-card'

export interface AdminStatStripItem {
  label: string
  value: string
  footnote?: string
  tone?: AdminStatTone
  active?: boolean
  onClick?: () => void
}

interface AdminStatStripProps {
  items: AdminStatStripItem[]
  className?: string
}

export function AdminStatStrip({ items, className }: AdminStatStripProps) {
  return (
    <div className={cn('admin-surface grid gap-0 sm:grid-cols-2 xl:grid-cols-4', className)}>
      {items.map((item, index) => (
        <AdminStatCard
          key={item.label}
          {...item}
          bare
          className={cn(
            index > 0 && 'border-t border-border/70 sm:border-t-0',
            index % 2 === 1 && 'sm:border-l',
            index > 0 && 'xl:border-l',
          )}
        />
      ))}
    </div>
  )
}
