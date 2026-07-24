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
        pathname === '/admin/listings/bulk' ||
        pathname === '/admin/users' ||
        pathname === '/admin/wallets' ||
        pathname === '/admin/settings' ||
        pathname === '/admin/seo' ||
        pathname === '/admin/google-merchant' ||
        pathname === '/admin/google-analytics' ||
        pathname === '/admin/search-curation' ||
        pathname === '/admin/shipping' ||
        pathname === '/admin/tools' ||
        pathname === '/admin/site-assets' ||
        pathname === '/admin/pnl' ||
        pathname === '/admin/listings/brand-model-autofills' ||
        pathname === '/admin/orders/test-purchase' ||
        pathname === '/admin/orders/terminal' ||
        pathname === '/admin/promo-codes' ||
        pathname === '/admin/fbcatalog' ||
        pathname === '/admin/shop'
      ) {
        router.replace('/admin')
      }
    }
  }, [isAdmin, isEmployee, pathname, router])

  return <>{children}</>
}
