'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { MessageSquare } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

interface MessageListingButtonProps {
  listingId: string
  sellerId: string
  /** Path back to the listing (e.g. `/l/my-listing-slug`) for login redirect */
  redirectPath: string
  size?: 'sm' | 'default' | 'lg'
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'link'
  className?: string
}

export function MessageListingButton({
  listingId,
  sellerId,
  redirectPath,
  size = 'sm',
  variant = 'outline',
  className,
}: MessageListingButtonProps) {
  const [currentUserId, setCurrentUserId] = useState<string | null | undefined>(undefined)
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setCurrentUserId(user?.id ?? null))
  }, [supabase])

  if (currentUserId === undefined) return null
  if (currentUserId === sellerId) return null

  const href = currentUserId
    ? `/messages?user=${sellerId}&listing=${listingId}`
    : `/auth/login?redirect=${encodeURIComponent(redirectPath)}`

  return (
    <Button variant={variant} size={size} className={className} asChild>
      <Link href={href}>
        <MessageSquare className="h-4 w-4 mr-2" />
        Message
      </Link>
    </Button>
  )
}
