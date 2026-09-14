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
    <div className={cn('admin-surface grid grid-cols-2 gap-0 xl:grid-cols-4', className)}>
      {items.map((item, index) => (
        <AdminStatCard
          key={item.label}
          {...item}
          bare
          className={cn(
            index % 2 === 1 && 'border-l border-border/70',
            index >= 2 && 'border-t border-border/70 xl:border-t-0',
            index > 0 && 'xl:border-l',
          )}
        />
      ))}
    </div>
  )
}
