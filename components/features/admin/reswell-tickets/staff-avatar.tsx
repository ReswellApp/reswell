import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import type { ReswellTicketStaff } from '@/lib/types/reswellTickets'
import { staffAvatarTone, staffInitials } from './ticket-ui'

interface StaffAvatarProps {
  person: ReswellTicketStaff
  size?: 'xs' | 'sm' | 'md'
  className?: string
}

const SIZE_CLASS = {
  xs: 'h-5 w-5 text-[10px]',
  sm: 'h-6 w-6 text-[11px]',
  md: 'h-8 w-8 text-xs',
} as const

export function StaffAvatar({ person, size = 'sm', className }: StaffAvatarProps) {
  return (
    <Avatar className={cn(SIZE_CLASS[size], className)}>
      {person.avatarUrl ? <AvatarImage src={person.avatarUrl} alt={person.name} /> : null}
      <AvatarFallback
        className={cn('font-medium text-white', staffAvatarTone(person.id))}
      >
        {staffInitials(person)}
      </AvatarFallback>
    </Avatar>
  )
}
