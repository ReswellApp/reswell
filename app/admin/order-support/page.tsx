'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { LifeBuoy } from 'lucide-react'
import { format } from 'date-fns'

type Row = {
  id: string
  order_id: string
  buyer_id: string
  request_type: string
  body: string
  contacted_seller_first: boolean | null
  order_ref: string
  created_at: string
}

function typeLabel(t: string) {
  switch (t) {
    case 'help':
      return 'Question'
    case 'cancel_order':
      return 'Cancel'
    case 'refund_help':
      return 'Refund help'
    default:
      return t
  }
}

export default function AdminOrderSupportPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('order_support_requests')
        .select('id, order_id, buyer_id, request_type, body, contacted_seller_first, order_ref, created_at')
        .order('created_at', { ascending: false })
        .limit(200)

      if (!error && data) {
        setRows(data as Row[])
      }
      setLoading(false)
    }
    void load()
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Support requests</h1>
        <p className="text-muted-foreground">
          Requests from buyers and sellers (questions, cancellations, refund assistance, returns).
          Click <strong>View</strong> to open the order detail where admins can issue refunds.
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          Browse all orders in{' '}
          <Link href="/admin/orders" className="font-medium text-primary underline underline-offset-4">
            Orders
          </Link>
          .
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center">
              <LifeBuoy className="h-8 w-8 animate-pulse text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">Loading…</p>
            </div>
          ) : rows.length === 0 ? (
            <div className="p-8 text-center">
              <LifeBuoy className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">No buyer requests yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Contacted seller first</TableHead>
                  <TableHead className="max-w-[min(40vw,420px)]">Message</TableHead>
                  <TableHead className="w-[1%] whitespace-nowrap text-right">Order page</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground text-sm">
                      {format(new Date(r.created_at), 'MMM d, yyyy HH:mm')}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      #{r.order_ref}
                      <span className="block text-[11px] text-muted-foreground truncate max-w-[140px]" title={r.order_id}>
                        {r.order_id.slice(0, 8)}…
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{typeLabel(r.request_type)}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.request_type === 'refund_help'
                        ? r.contacted_seller_first === true
                          ? 'Yes'
                          : r.contacted_seller_first === false
                            ? 'No'
                            : '—'
                        : '—'}
                    </TableCell>
                    <TableCell className="text-sm align-top whitespace-pre-wrap break-words">
                      {r.body}
                    </TableCell>
                    <TableCell className="text-right align-top">
                      <Link
                        href={`/admin/orders/${r.order_id}`}
                        className="text-sm font-medium text-primary underline underline-offset-4 hover:text-primary/90"
                      >
                        View
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
