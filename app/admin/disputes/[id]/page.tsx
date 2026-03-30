import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import {
  ChevronLeft,
  ShieldAlert,
  User,
  Package,
  Flag,
  MessageSquare,
  FileImage,
  Clock,
  AlertTriangle,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AdminDisputeActions } from './admin-dispute-actions'
import {
  DISPUTE_REASON_LABELS,
  DISPUTE_STATUS_LABELS,
  DISPUTE_STATUS_COLORS,
  DISPUTE_RESOLUTION_LABELS,
  isDisputeResolved,
  type DisputeReason,
  type DisputeStatus,
  type DisputeResolution,
} from '@/lib/disputes/constants'
import { capitalizeWords } from '@/lib/listing-labels'
import type { Dispute } from '@/lib/disputes/types'

type Props = { params: Promise<{ id: string }> }

export default async function AdminDisputeDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: adminProfile } = await supabase
    .from('profiles')
    .select('is_admin, is_employee')
    .eq('id', user.id)
    .single()

  if (!adminProfile?.is_admin && !adminProfile?.is_employee) {
    redirect('/dashboard')
  }

  const { data: disputeData, error } = await supabase
    .from('disputes')
    .select(
      `
      *,
      purchases (
        id,
        amount,
        fulfillment_method,
        stripe_checkout_session_id,
        listings ( id, title, slug, section, price, condition )
      )
    `
    )
    .eq('id', id)
    .single()

  if (error || !disputeData) notFound()

  const [
    { data: messages },
    { data: evidence },
    { data: flags },
    { data: buyerProfile },
    { data: sellerProfile },
    { data: buyerHistory },
    { data: sellerHistory },
  ] = await Promise.all([
    supabase
      .from('dispute_messages')
      .select('*')
      .eq('dispute_id', id)
      .order('created_at', { ascending: true }),
    supabase
      .from('dispute_evidence')
      .select('*')
      .eq('dispute_id', id)
      .order('created_at', { ascending: true }),
    supabase
      .from('dispute_flags')
      .select('*')
      .eq('dispute_id', id),
    supabase
      .from('profiles')
      .select('id, display_name, email, created_at')
      .eq('id', disputeData.buyer_id)
      .single(),
    supabase
      .from('profiles')
      .select('id, display_name, email, created_at')
      .eq('id', disputeData.seller_id)
      .single(),
    supabase
      .from('disputes')
      .select('id, reason, status, claimed_amount, created_at')
      .eq('buyer_id', disputeData.buyer_id)
      .neq('id', id)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('disputes')
      .select('id, reason, status, claimed_amount, created_at')
      .eq('seller_id', disputeData.seller_id)
      .neq('id', id)
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  const purchase = Array.isArray(disputeData.purchases)
    ? disputeData.purchases[0]
    : disputeData.purchases
  const listing = purchase
    ? Array.isArray(purchase.listings)
      ? purchase.listings[0]
      : purchase.listings
    : null
  const title = listing?.title ? capitalizeWords(listing.title) : 'Dispute'

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { purchases: _purchases, ...dispute } = disputeData as typeof disputeData & { purchases: unknown }

  const isResolved = isDisputeResolved(dispute.status as DisputeStatus)
  const hasFraudFlags = (flags ?? []).length > 0

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/disputes"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ChevronLeft className="h-4 w-4" /> All disputes
        </Link>

        <div className="flex flex-wrap items-start gap-3 justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  DISPUTE_STATUS_COLORS[dispute.status as DisputeStatus]
                }`}
              >
                {DISPUTE_STATUS_LABELS[dispute.status as DisputeStatus]}
              </span>
              <span className="text-xs text-muted-foreground">
                {DISPUTE_REASON_LABELS[dispute.reason as DisputeReason]}
              </span>
              {hasFraudFlags && (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-300">
                  <Flag className="h-3 w-3" />
                  Fraud flags
                </span>
              )}
              {dispute.is_large_item && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                  <Package className="h-3 w-3" /> Large item — freight logistics
                </span>
              )}
            </div>
            <h1 className="text-xl font-bold font-mono tracking-tight">{title}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              #{id.slice(0, 8).toUpperCase()}
              {' '}·{' '}
              Claimed: ${Number(dispute.claimed_amount).toFixed(2)}
              {' '}·{' '}
              {DISPUTE_RESOLUTION_LABELS[dispute.desired_resolution as DisputeResolution]}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left: main content ─────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Dispute description */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Buyer's description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                {dispute.description}
              </p>
              {(dispute.damage_types as string[])?.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs text-muted-foreground font-medium mb-1">Damage types</p>
                  <div className="flex flex-wrap gap-1">
                    {(dispute.damage_types as string[]).map((dt) => (
                      <span
                        key={dt}
                        className="rounded-full bg-muted px-2 py-0.5 text-xs"
                      >
                        {dt}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {dispute.damage_during_shipping && (
                <p className="text-xs text-muted-foreground mt-2">
                  Damage during shipping:{' '}
                  <span className="text-foreground">{dispute.damage_during_shipping}</span>
                </p>
              )}
            </CardContent>
          </Card>

          {/* Fraud flags */}
          {hasFraudFlags && (
            <Card className="border-red-200 dark:border-red-800/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-red-700 dark:text-red-400">
                  <Flag className="h-4 w-4" /> Fraud signals
                  <span className="text-xs font-normal text-muted-foreground">(not visible to users)</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {(flags ?? []).map((flag) => (
                    <div key={flag.id} className="flex items-start gap-2 text-sm">
                      <AlertTriangle className="h-3.5 w-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                      <span className="font-mono text-xs text-red-700 dark:text-red-400">
                        {flag.flag_type}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Evidence */}
          {(evidence ?? []).length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <FileImage className="h-4 w-4" /> Evidence ({(evidence ?? []).length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(evidence ?? []).map((ev) => (
                    <a
                      key={ev.id}
                      href={ev.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="aspect-square rounded-lg overflow-hidden border bg-muted block"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={ev.url}
                        alt={ev.caption ?? 'Evidence'}
                        className="h-full w-full object-cover hover:opacity-90 transition-opacity"
                      />
                    </a>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Message thread */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <MessageSquare className="h-4 w-4" /> Thread ({(messages ?? []).length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(messages ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No messages yet.</p>
              ) : (
                <div className="space-y-3">
                  {(messages ?? []).map((msg) => (
                    <div key={msg.id} className="rounded-lg border p-3">
                      <div className="flex items-center gap-2 mb-1.5 text-xs text-muted-foreground">
                        <span
                          className={`font-semibold ${
                            msg.sender_role === 'ADMIN'
                              ? 'text-blue-600 dark:text-blue-400'
                              : msg.sender_role === 'BUYER'
                              ? 'text-foreground'
                              : 'text-orange-600 dark:text-orange-400'
                          }`}
                        >
                          {msg.sender_role === 'ADMIN'
                            ? 'Reswell Team'
                            : msg.sender_role === 'BUYER'
                            ? buyerProfile?.display_name ?? 'Buyer'
                            : sellerProfile?.display_name ?? 'Seller'}
                        </span>
                        <span>·</span>
                        <span>
                          {new Date(msg.created_at).toLocaleString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="text-sm">{msg.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Right: sidebar ─────────────────────────────────────────────── */}
        <div className="space-y-4">
          {/* Admin actions */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-orange-500" /> Admin actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AdminDisputeActions dispute={dispute as Dispute} />
            </CardContent>
          </Card>

          {/* Dispute meta */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4" /> Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-xs">
                <MetaRow label="Opened" value={new Date(dispute.created_at).toLocaleString()} />
                <MetaRow
                  label="Deadline"
                  value={new Date(dispute.deadline_at).toLocaleString()}
                  highlight={new Date(dispute.deadline_at) < new Date() ? 'red' : undefined}
                />
                {dispute.return_label_url && (
                  <MetaRow label="Label sent" value="Yes" />
                )}
                {dispute.return_tracking && (
                  <MetaRow label="Return tracking" value={dispute.return_tracking} mono />
                )}
                {dispute.return_shipped_at && (
                  <MetaRow
                    label="Buyer shipped"
                    value={new Date(dispute.return_shipped_at as string).toLocaleString()}
                  />
                )}
                {dispute.return_received_at && (
                  <MetaRow
                    label="Return received"
                    value={new Date(dispute.return_received_at as string).toLocaleString()}
                  />
                )}
                {dispute.resolved_at && (
                  <MetaRow
                    label="Resolved"
                    value={new Date(dispute.resolved_at as string).toLocaleString()}
                    highlight="green"
                  />
                )}
                {dispute.approved_amount != null && (
                  <MetaRow
                    label="Approved amount"
                    value={`$${Number(dispute.approved_amount).toFixed(2)}`}
                  />
                )}
              </div>

              {dispute.admin_notes && (
                <div className="mt-3 pt-3 border-t">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Admin notes</p>
                  <p className="text-xs whitespace-pre-wrap">{dispute.admin_notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Buyer info */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <User className="h-4 w-4" /> Buyer
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1 text-xs mb-3">
                <p className="font-medium">{buyerProfile?.display_name ?? 'Unknown'}</p>
                <p className="text-muted-foreground">{buyerProfile?.email}</p>
                {buyerProfile?.created_at && (
                  <p className="text-muted-foreground">
                    Member since{' '}
                    {new Date(buyerProfile.created_at).toLocaleDateString(undefined, {
                      month: 'short',
                      year: 'numeric',
                    })}
                  </p>
                )}
              </div>
              {(buyerHistory ?? []).length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">
                    Recent disputes ({(buyerHistory ?? []).length})
                  </p>
                  <div className="space-y-1">
                    {(buyerHistory ?? []).map((h) => (
                      <Link
                        key={h.id}
                        href={`/admin/disputes/${h.id}`}
                        className="flex items-center justify-between text-xs hover:underline"
                      >
                        <span className="text-muted-foreground">
                          {DISPUTE_REASON_LABELS[h.reason as DisputeReason]}
                        </span>
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-xs ${
                            DISPUTE_STATUS_COLORS[h.status as DisputeStatus]
                          }`}
                        >
                          {DISPUTE_STATUS_LABELS[h.status as DisputeStatus]}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Seller info */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <User className="h-4 w-4" /> Seller
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1 text-xs mb-3">
                <p className="font-medium">{sellerProfile?.display_name ?? 'Unknown'}</p>
                <p className="text-muted-foreground">{sellerProfile?.email}</p>
              </div>
              {(sellerHistory ?? []).length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">
                    Dispute history ({(sellerHistory ?? []).length})
                  </p>
                  <div className="space-y-1">
                    {(sellerHistory ?? []).map((h) => (
                      <Link
                        key={h.id}
                        href={`/admin/disputes/${h.id}`}
                        className="flex items-center justify-between text-xs hover:underline"
                      >
                        <span className="text-muted-foreground">
                          {DISPUTE_REASON_LABELS[h.reason as DisputeReason]}
                        </span>
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-xs ${
                            DISPUTE_STATUS_COLORS[h.status as DisputeStatus]
                          }`}
                        >
                          {DISPUTE_STATUS_LABELS[h.status as DisputeStatus]}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Order info */}
          {purchase && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Package className="h-4 w-4" /> Order
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1 text-xs">
                  <p className="font-medium">{title}</p>
                  <MetaRow
                    label="Order total"
                    value={`$${Number(purchase.amount).toFixed(2)}`}
                  />
                  {(listing as { section?: string } | null)?.section && (
                    <MetaRow label="Category" value={(listing as { section: string }).section} />
                  )}
                  {(listing as { condition?: string } | null)?.condition && (
                    <MetaRow label="Condition" value={(listing as { condition: string }).condition} />
                  )}
                </div>
                <Link
                  href={`/admin/orders`}
                  className="mt-2 block text-xs text-blue-600 underline dark:text-blue-400"
                >
                  View order in admin
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

function MetaRow({
  label,
  value,
  mono = false,
  highlight,
}: {
  label: string
  value: string
  mono?: boolean
  highlight?: 'green' | 'red'
}) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground flex-shrink-0">{label}</span>
      <span
        className={`text-right ${mono ? 'font-mono' : ''} ${
          highlight === 'green'
            ? 'text-green-600 dark:text-green-400'
            : highlight === 'red'
            ? 'text-red-600 dark:text-red-400'
            : ''
        }`}
      >
        {value}
      </span>
    </div>
  )
}
