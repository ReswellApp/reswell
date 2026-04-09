'use client'

import { usePathname } from 'next/navigation'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export function AdminGuard({
  isAdmin,
  isEmployee,
  children,
}: {
  isAdmin: boolean
  isEmployee: boolean
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (!isAdmin && isEmployee && pathname) {
      if (
        pathname === '/admin/users' ||
        pathname === '/admin/settings' ||
        pathname === '/admin/shipping' ||
        pathname === '/admin/shippo'
      ) {
        router.replace('/admin')
      }
    }
  }, [isAdmin, isEmployee, pathname, router])

  return <>{children}</>
}
