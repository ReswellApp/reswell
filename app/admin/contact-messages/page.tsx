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
import { MessageSquare } from 'lucide-react'
import { format } from 'date-fns'

interface ContactMessage {
  id: string
  name: string
  email: string
  message: string
  created_at: string
}

export default function AdminContactMessagesPage() {
  const [messages, setMessages] = useState<ContactMessage[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function fetchMessages() {
      const { data, error } = await supabase
        .from('contact_messages')
        .select('id, name, email, message, created_at')
        .order('created_at', { ascending: false })

      if (!error && data) {
        setMessages(data as ContactMessage[])
      }
      setLoading(false)
    }
    fetchMessages()
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Contact messages</h1>
        <p className="text-muted-foreground">Messages sent from the Contact us page</p>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center">
              <MessageSquare className="h-8 w-8 animate-pulse text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">Loading messages...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="p-8 text-center">
              <MessageSquare className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">No contact messages yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {messages.map((msg) => (
                  <TableRow key={msg.id}>
                    <TableCell className="font-medium text-foreground">{msg.name}</TableCell>
                    <TableCell>
                      <a
                        href={`mailto:${msg.email}`}
                        className="text-primary hover:underline"
                      >
                        {msg.email}
                      </a>
                    </TableCell>
                    <TableCell className="max-w-md">
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-3">
                        {msg.message}
                      </p>
                    </TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {format(new Date(msg.created_at), 'MMM d, yyyy HH:mm')}
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
