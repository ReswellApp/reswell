'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreVertical, Flag, ExternalLink, CheckCircle, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { capitalizeWords } from '@/lib/listing-labels'

interface Report {
  id: string
  reason: string
  description: string | null
  status: string
  created_at: string
  reporter: { display_name: string; email: string }
  listing: { id: string; title: string; section: string } | null
  reported_user: { id: string; display_name: string; email: string } | null
}

export default function AdminReportsPage() {
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('pending')
  const supabase = createClient()

  useEffect(() => {
    fetchReports()
  }, [statusFilter])

  async function fetchReports() {
    let query = supabase
      .from('reports')
      .select(`
        id, reason, description, status, created_at,
        reporter:profiles!reports_reporter_id_fkey(display_name, email),
        listing:listings(id, title, section),
        reported_user:profiles!reports_reported_user_id_fkey(id, display_name, email)
      `)
      .order('created_at', { ascending: false })

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter)
    }

    const { data, error } = await query

    if (!error && data) {
      setReports(data as unknown as Report[])
    }
    setLoading(false)
  }

  async function updateReportStatus(id: string, newStatus: string) {
    const { error } = await supabase
      .from('reports')
      .update({ status: newStatus })
      .eq('id', id)

    if (!error) {
      setReports(prev => prev.map(r => r.id === id ? { ...r, status: newStatus } : r))
      toast.success(`Report marked as ${newStatus}`)
    } else {
      toast.error('Failed to update report')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-neutral-50 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200'
      case 'reviewed': return 'bg-neutral-200 text-neutral-900 dark:bg-neutral-700 dark:text-neutral-100'
      case 'resolved': return 'bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100'
      case 'dismissed': return 'bg-muted text-muted-foreground'
      default: return 'bg-muted text-muted-foreground'
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Reports</h1>
        <p className="text-muted-foreground">Review and handle user reports</p>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="reviewed">Reviewed</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="dismissed">Dismissed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Reports Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center">
              <Flag className="h-8 w-8 animate-pulse text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">Loading reports...</p>
            </div>
          ) : reports.length === 0 ? (
            <div className="p-8 text-center">
              <Flag className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">No reports found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reason</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Reporter</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-foreground capitalize">{report.reason}</p>
                        {report.description && (
                          <p className="text-sm text-muted-foreground line-clamp-1 max-w-[200px]">
                            {report.description}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {report.listing ? (
                        <Link 
                          href={`/${report.listing.section}/${report.listing.id}`}
                          className="text-primary hover:underline flex items-center gap-1"
                        >
                          {capitalizeWords(report.listing?.title)}
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      ) : report.reported_user ? (
                        <span className="text-muted-foreground">
                          User: {report.reported_user.display_name}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Unknown</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {report.reporter?.display_name || 'Unknown'}
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(report.status)}>
                        {report.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(report.created_at), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {report.status === 'pending' && (
                            <>
                              <DropdownMenuItem onClick={() => updateReportStatus(report.id, 'reviewed')}>
                                Mark as Reviewed
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => updateReportStatus(report.id, 'resolved')}>
                                <CheckCircle className="h-4 w-4 mr-2" /> Resolve
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => updateReportStatus(report.id, 'dismissed')}>
                                <XCircle className="h-4 w-4 mr-2" /> Dismiss
                              </DropdownMenuItem>
                            </>
                          )}
                          {report.status === 'reviewed' && (
                            <>
                              <DropdownMenuItem onClick={() => updateReportStatus(report.id, 'resolved')}>
                                <CheckCircle className="h-4 w-4 mr-2" /> Resolve
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => updateReportStatus(report.id, 'dismissed')}>
                                <XCircle className="h-4 w-4 mr-2" /> Dismiss
                              </DropdownMenuItem>
                            </>
                          )}
                          {(report.status === 'resolved' || report.status === 'dismissed') && (
                            <DropdownMenuItem onClick={() => updateReportStatus(report.id, 'pending')}>
                              Reopen
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
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
