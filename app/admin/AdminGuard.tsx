'use client'

import { usePathname } from 'next/navigation'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { employeeAdminPathDecision } from '@/lib/admin/employee-access'

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
    if (isAdmin || !isEmployee || !pathname) return
    const decision = employeeAdminPathDecision(pathname, new URLSearchParams(window.location.search))
    if (decision.allow) return
    const target = `${decision.redirectPath}${decision.redirectSearch}`
    const current = `${pathname}${window.location.search}`
    if (target !== current) router.replace(target)
  }, [isAdmin, isEmployee, pathname, router])

  return <>{children}</>
}
