import { privatePageMetadata } from '@/lib/site-metadata'
import { ShippoAdminClient } from './shippo-admin-client'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export const metadata = privatePageMetadata({
  title: 'Shippo — Admin — Reswell',
  description: 'Shippo integration status, rates, and troubleshooting for Reswell shipping.',
  path: '/admin/shippo',
})

export default async function AdminShippoPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/auth/login?redirect=/admin/shippo')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.is_admin) {
    redirect('/')
  }

  return <ShippoAdminClient />
}
