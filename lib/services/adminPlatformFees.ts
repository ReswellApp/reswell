import { createServiceRoleClient } from '@/lib/supabase/server'

export type AdminPlatformPurchaseFees = {
  totalFees: number
  totalFeesFulfilled: number
  fulfilledOrderCount: number
  confirmedCount: number
  totalSaleVolume: number
}

export async function loadAdminPlatformPurchaseFees(): Promise<
  | { ok: true; data: AdminPlatformPurchaseFees }
  | { ok: false; error: string }
> {
  try {
    const adminDb = createServiceRoleClient()
    const { data: orderRows, error: ordersError } = await adminDb
      .from('orders')
      .select('platform_fee, amount, delivery_status')
      .eq('status', 'confirmed')

    if (ordersError) {
      return { ok: false, error: 'Could not load purchase fee totals.' }
    }

    const rows = orderRows ?? []
    const fulfilled = rows.filter((r) =>
      r.delivery_status === 'delivered' || r.delivery_status === 'picked_up',
    )

    return {
      ok: true,
      data: {
        totalFees: rows.reduce((s, r) => s + Number(r.platform_fee ?? 0), 0),
        totalFeesFulfilled: fulfilled.reduce((s, r) => s + Number(r.platform_fee ?? 0), 0),
        fulfilledOrderCount: fulfilled.length,
        confirmedCount: rows.length,
        totalSaleVolume: rows.reduce((s, r) => s + Number(r.amount ?? 0), 0),
      },
    }
  } catch {
    return {
      ok: false,
      error:
        'Add SUPABASE_SERVICE_ROLE_KEY on the server to aggregate platform fees from orders.',
    }
  }
}
