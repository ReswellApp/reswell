import { Suspense } from 'react'
import { platformAccessForSignedInUser } from '@/lib/account-access/platform-access'
import { privatePageMetadata } from '@/lib/site-metadata'
import { AdminShippingClient } from './shipping-admin-client'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export const metadata = privatePageMetadata({
  title: 'Shipping — Admin — Reswell',
  description: 'Configure carriers, labels, and fulfillment tooling for Reswell shipments.',
  path: '/admin/shipping',
})

export default async function AdminShippingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/auth/login?redirect=/admin/shipping')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin, is_employee')
    .eq('id', user.id)
    .maybeSingle()

  const access = platformAccessForSignedInUser({ profile })
  if (!access.isAdmin && !access.isEmployee) {
    redirect('/')
  }

  return (
    <Suspense fallback={null}>
      <AdminShippingClient />
    </Suspense>
  )
}
