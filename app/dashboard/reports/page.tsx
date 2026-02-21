'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Flag, Loader2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { capitalizeWords } from '@/lib/listing-labels'

const REPORT_REASONS = [
  { value: 'spam', label: 'Spam' },
  { value: 'inappropriate', label: 'Inappropriate content' },
  { value: 'scam', label: 'Scam or fraud' },
  { value: 'fake', label: 'Fake or misleading' },
  { value: 'harassment', label: 'Harassment' },
  { value: 'other', label: 'Other' },
] as const

interface MyReport {
  id: string
  reason: string
  description: string | null
  status: string
  created_at: string
  listing: { id: string; title: string; section: string } | null
  reported_user: { id: string; display_name: string | null } | null
}

export default function DashboardReportsPage() {
  const supabase = createClient()
  const [reports, setReports] = useState<MyReport[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [type, setType] = useState<'listing' | 'user'>('listing')
  const [listingInput, setListingInput] = useState('')
  const [userInput, setUserInput] = useState('')
  const [reason, setReason] = useState('')
  const [description, setDescription] = useState('')

  useEffect(() => {
    fetchReports()
  }, [])

  async function fetchReports() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }
    const { data } = await supabase
      .from('reports')
      .select(`
        id, reason, description, status, created_at,
        listing:listings(id, title, section),
        reported_user:profiles!reports_reported_user_id_fkey(id, display_name)
      `)
      .eq('reporter_id', user.id)
      .order('created_at', { ascending: false })
    setReports((data as MyReport[]) || [])
    setLoading(false)
  }

  function parseListingId(input: string): string | null {
    const trimmed = input.trim()
    if (!trimmed) return null
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (uuidRegex.test(trimmed)) return trimmed
    const match = trimmed.match(/\/(used|boards|shop)\/([0-9a-f-]{36})/i)
    return match ? match[2] : null
  }

  function parseUserId(input: string): string | null {
    const trimmed = input.trim()
    if (!trimmed) return null
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (uuidRegex.test(trimmed)) return trimmed
    const match = trimmed.match(/\/sellers\/([0-9a-f-]{36})/i)
    return match ? match[1] : null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!reason) {
      toast.error('Please select a reason')
      return
    }
    if (type === 'listing') {
      const listingId = parseListingId(listingInput)
      if (!listingId) {
        toast.error('Enter a valid listing link or ID (e.g. /used/... or paste the listing ID)')
        return
      }
      setSubmitting(true)
      try {
        const res = await fetch('/api/reports', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'listing',
            listing_id: listingId,
            reason,
            description: description || undefined,
          }),
        })
        const data = await res.json()
        if (!res.ok) {
          toast.error(data.error || 'Failed to submit report')
          setSubmitting(false)
          return
        }
        toast.success('Report submitted. Our team will review it.')
        setListingInput('')
        setReason('')
        setDescription('')
        fetchReports()
      } catch {
        toast.error('Failed to submit report')
      }
      setSubmitting(false)
      return
    }
    const userId = parseUserId(userInput)
    if (!userId) {
      toast.error('Enter a valid user profile link or ID (e.g. /sellers/... or paste the user ID)')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'user',
          reported_user_id: userId,
          reason,
          description: description || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed to submit report')
        setSubmitting(false)
        return
      }
      toast.success('Report submitted. Our team will review it.')
      setUserInput('')
      setReason('')
      setDescription('')
      fetchReports()
    } catch {
      toast.error('Failed to submit report')
    }
    setSubmitting(false)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
      case 'reviewed':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      case 'resolved':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'dismissed':
        return 'bg-muted text-muted-foreground'
      default:
        return 'bg-muted text-muted-foreground'
    }
  }

  const getSectionHref = (section: string) => {
    if (section === 'surfboards') return '/boards'
    if (section === 'new') return '/shop'
    return '/used'
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Reports</h1>
        <p className="text-muted-foreground">
          Submit a report about a listing or user. Reports are sent to the marketplace admin for review.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Submit a report
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Report a listing or user that violates our guidelines. Your report will be reviewed by the admin team.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>What are you reporting?</Label>
              <Select value={type} onValueChange={(v: 'listing' | 'user') => setType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="listing">A listing</SelectItem>
                  <SelectItem value="user">A user</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {type === 'listing' && (
              <div>
                <Label>Listing link or ID</Label>
                <Input
                  value={listingInput}
                  onChange={(e) => setListingInput(e.target.value)}
                  placeholder="e.g. https://.../used/abc-123 or paste listing ID"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Paste the full listing URL (from Used, Boards, or Shop) or the listing ID.
                </p>
              </div>
            )}

            {type === 'user' && (
              <div>
                <Label>User profile link or ID</Label>
                <Input
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  placeholder="e.g. https://.../sellers/abc-123 or paste user ID"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Paste the seller/profile URL or the user ID.
                </p>
              </div>
            )}

            <div>
              <Label>Reason *</Label>
              <Select value={reason} onValueChange={setReason} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select a reason" />
                </SelectTrigger>
                <SelectContent>
                  {REPORT_REASONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Additional details (optional)</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Any extra context for the admin..."
                rows={3}
              />
            </div>

            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Flag className="h-4 w-4 mr-2" />
              Submit report
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Flag className="h-5 w-5" />
            My reports
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Reports you have submitted and their status. Admin reviews these in the Reports panel.
          </p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : reports.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              You have not submitted any reports yet.
            </p>
          ) : (
            <ul className="space-y-4">
              {reports.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
                >
                  <div>
                    <p className="font-medium text-foreground capitalize">{r.reason}</p>
                    {r.listing ? (
                      <Link
                        href={`${getSectionHref(r.listing.section)}/${r.listing.id}`}
                        className="text-sm text-primary hover:underline"
                      >
                        Listing: {capitalizeWords(r.listing?.title)}
                      </Link>
                    ) : r.reported_user ? (
                      <Link
                        href={`/sellers/${r.reported_user.id}`}
                        className="text-sm text-primary hover:underline"
                      >
                        User: {r.reported_user.display_name || 'Unknown'}
                      </Link>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                    {r.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {r.description}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(r.created_at), 'MMM d, yyyy HH:mm')}
                    </p>
                  </div>
                  <Badge className={getStatusColor(r.status)}>{r.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
