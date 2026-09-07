'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import type {
  ReswellTicket,
  ReswellTicketComment,
  ReswellTicketFile,
  ReswellTicketFileKind,
  ReswellTicketStaff,
  ReswellTicketSubtask,
  ReswellTicketView,
  ReswellTicketsSnapshot,
} from '@/lib/types/reswellTickets'
import type { UpdateReswellTicketInput } from '@/lib/validations/reswellTickets'
import { uploadTicketImageFromBrowser } from '@/lib/services/reswellTicketImageUploadClient'
import { isOpenStatus } from '../ticket-ui'

export type TicketSortKey = 'created' | 'due' | 'title' | 'status'

async function readJson(res: Response): Promise<unknown> {
  return res.json().catch(() => ({}))
}

function errorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string') {
    return body.error
  }
  return fallback
}

export function useReswellTickets() {
  const [tickets, setTickets] = useState<ReswellTicket[]>([])
  const [staff, setStaff] = useState<ReswellTicketStaff[]>([])
  const [currentUserId, setCurrentUserId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<ReswellTicketView>('all')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<TicketSortKey>('created')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch('/api/admin/reswell-tickets', { credentials: 'include' })
      const body = await readJson(res)
      if (!res.ok) {
        setError(errorMessage(body, 'Could not load tickets. Run the latest database migration.'))
        return
      }
      if (!body || typeof body !== 'object' || !('data' in body)) {
        setError('Invalid response from server')
        return
      }
      const data = (body as { data: ReswellTicketsSnapshot }).data
      setTickets(data.tickets)
      setStaff(data.staff)
      setCurrentUserId(data.currentUserId)
    } catch {
      setError('Could not load tickets.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const replaceTicket = useCallback((next: ReswellTicket) => {
    setTickets((prev) => prev.map((ticket) => (ticket.id === next.id ? next : ticket)))
  }, [])

  const updateTicket = useCallback(
    async (id: string, patch: UpdateReswellTicketInput) => {
      const previous = tickets.find((ticket) => ticket.id === id)
      if (previous) {
        setTickets((prev) =>
          prev.map((ticket) => {
            if (ticket.id !== id) return ticket
            const assignees = patch.assigneeIds
              ? staff.filter((person) => patch.assigneeIds?.includes(person.id))
              : ticket.assignees
            return {
              ...ticket,
              title: patch.title ?? ticket.title,
              status: patch.status ?? ticket.status,
              dueDate: patch.dueDate !== undefined ? patch.dueDate : ticket.dueDate,
              priority: patch.priority !== undefined ? patch.priority : ticket.priority,
              taskType: patch.taskType !== undefined ? patch.taskType : ticket.taskType,
              effortLevel: patch.effortLevel !== undefined ? patch.effortLevel : ticket.effortLevel,
              description: patch.description ?? ticket.description,
              descriptionImageUrl:
                patch.descriptionImageUrl !== undefined
                  ? patch.descriptionImageUrl
                  : ticket.descriptionImageUrl,
              assignees,
            }
          }),
        )
      }

      const res = await fetch(`/api/admin/reswell-tickets/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const body = await readJson(res)
      if (!res.ok) {
        if (previous) replaceTicket(previous)
        toast.error(errorMessage(body, 'Could not update ticket'))
        return
      }
      if (body && typeof body === 'object' && 'data' in body) {
        replaceTicket((body as { data: ReswellTicket }).data)
      }
    },
    [replaceTicket, staff, tickets],
  )

  const createTicket = useCallback(async () => {
    const res = await fetch('/api/admin/reswell-tickets', {
      method: 'POST',
      credentials: 'include',
    })
    const body = await readJson(res)
    if (!res.ok) {
      toast.error(errorMessage(body, 'Could not create ticket'))
      return null
    }
    const ticket = (body as { data: ReswellTicket }).data
    setTickets((prev) => [ticket, ...prev])
    setSelectedId(ticket.id)
    return ticket
  }, [])

  const deleteTicket = useCallback(async (id: string) => {
    const previous = tickets
    setTickets((prev) => prev.filter((ticket) => ticket.id !== id))
    if (selectedId === id) setSelectedId(null)
    const res = await fetch(`/api/admin/reswell-tickets/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    if (!res.ok) {
      setTickets(previous)
      toast.error('Could not delete ticket')
    }
  }, [selectedId, tickets])

  const addComment = useCallback(async (ticketId: string, text: string) => {
    const res = await fetch(`/api/admin/reswell-tickets/${ticketId}/comments`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: text }),
    })
    const body = await readJson(res)
    if (!res.ok) {
      toast.error(errorMessage(body, 'Could not add comment'))
      return
    }
    const comment = (body as { data: ReswellTicketComment }).data
    setTickets((prev) =>
      prev.map((ticket) =>
        ticket.id === ticketId ? { ...ticket, comments: [...ticket.comments, comment] } : ticket,
      ),
    )
  }, [])

  const deleteComment = useCallback(async (ticketId: string, commentId: string) => {
    const res = await fetch(`/api/admin/reswell-tickets/${ticketId}/comments`, {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: commentId }),
    })
    if (!res.ok) {
      toast.error('Could not delete comment')
      return
    }
    setTickets((prev) =>
      prev.map((ticket) =>
        ticket.id === ticketId
          ? { ...ticket, comments: ticket.comments.filter((comment) => comment.id !== commentId) }
          : ticket,
      ),
    )
  }, [])

  const addSubtask = useCallback(async (ticketId: string) => {
    const res = await fetch(`/api/admin/reswell-tickets/${ticketId}/subtasks`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '' }),
    })
    const body = await readJson(res)
    if (!res.ok) {
      toast.error(errorMessage(body, 'Could not add sub-task'))
      return
    }
    const subtask = (body as { data: ReswellTicketSubtask }).data
    setTickets((prev) =>
      prev.map((ticket) =>
        ticket.id === ticketId ? { ...ticket, subtasks: [...ticket.subtasks, subtask] } : ticket,
      ),
    )
  }, [])

  const updateSubtask = useCallback(
    async (ticketId: string, patch: { id: string; title?: string; completed?: boolean }) => {
      setTickets((prev) =>
        prev.map((ticket) =>
          ticket.id === ticketId
            ? {
                ...ticket,
                subtasks: ticket.subtasks.map((item) =>
                  item.id === patch.id ? { ...item, ...patch } : item,
                ),
              }
            : ticket,
        ),
      )
      const res = await fetch(`/api/admin/reswell-tickets/${ticketId}/subtasks`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) toast.error('Could not update sub-task')
    },
    [],
  )

  const deleteSubtask = useCallback(async (ticketId: string, subtaskId: string) => {
    setTickets((prev) =>
      prev.map((ticket) =>
        ticket.id === ticketId
          ? { ...ticket, subtasks: ticket.subtasks.filter((item) => item.id !== subtaskId) }
          : ticket,
      ),
    )
    const res = await fetch(`/api/admin/reswell-tickets/${ticketId}/subtasks`, {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: subtaskId }),
    })
    if (!res.ok) toast.error('Could not delete sub-task')
  }, [])

  const addFile = useCallback(
    async (ticketId: string, input: { kind: ReswellTicketFileKind; url: string; label?: string }) => {
      const res = await fetch(`/api/admin/reswell-tickets/${ticketId}/files`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      const body = await readJson(res)
      if (!res.ok) {
        toast.error(errorMessage(body, 'Could not add file'))
        return
      }
      const file = (body as { data: ReswellTicketFile }).data
      setTickets((prev) =>
        prev.map((ticket) =>
          ticket.id === ticketId ? { ...ticket, files: [...ticket.files, file] } : ticket,
        ),
      )
    },
    [],
  )

  const deleteFile = useCallback(async (ticketId: string, fileId: string) => {
    const current = tickets.find((ticket) => ticket.id === ticketId)
    const removed = current?.files.find((file) => file.id === fileId)
    const nextImageUrl =
      current?.files.filter((file) => file.id !== fileId && file.kind === 'image').at(-1)?.url ??
      null
    const clearPrimary = Boolean(removed && current?.descriptionImageUrl === removed.url)

    setTickets((prev) =>
      prev.map((ticket) =>
        ticket.id === ticketId
          ? {
              ...ticket,
              files: ticket.files.filter((file) => file.id !== fileId),
              descriptionImageUrl: clearPrimary ? nextImageUrl : ticket.descriptionImageUrl,
            }
          : ticket,
      ),
    )
    const res = await fetch(`/api/admin/reswell-tickets/${ticketId}/files`, {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: fileId }),
    })
    if (!res.ok) {
      toast.error('Could not remove file')
      return
    }
    if (clearPrimary) {
      await fetch(`/api/admin/reswell-tickets/${ticketId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ descriptionImageUrl: nextImageUrl }),
      })
    }
  }, [tickets])

  const uploadDescriptionImage = useCallback(async (ticketId: string, file: File) => {
    const pendingId = `pending-${crypto.randomUUID()}`
    const previewUrl = URL.createObjectURL(file)
    const pending: ReswellTicketFile = {
      id: pendingId,
      ticketId,
      kind: 'image',
      label: file.name,
      url: previewUrl,
      createdBy: currentUserId || null,
      createdAt: new Date().toISOString(),
    }
    setTickets((prev) =>
      prev.map((ticket) =>
        ticket.id === ticketId
          ? {
              ...ticket,
              descriptionImageUrl: previewUrl,
              files: [...ticket.files, pending],
            }
          : ticket,
      ),
    )

    const replacePending = (next: ReswellTicketFile | null) => {
      URL.revokeObjectURL(previewUrl)
      setTickets((prev) =>
        prev.map((ticket) => {
          if (ticket.id !== ticketId) return ticket
          const files = ticket.files.filter((item) => item.id !== pendingId)
          if (!next) {
            return {
              ...ticket,
              files,
              descriptionImageUrl:
                ticket.descriptionImageUrl === previewUrl
                  ? files.filter((item) => item.kind === 'image').at(-1)?.url ?? null
                  : ticket.descriptionImageUrl,
            }
          }
          return {
            ...ticket,
            descriptionImageUrl: next.url,
            files: [...files, next],
          }
        }),
      )
    }

    try {
      const url = await uploadTicketImageFromBrowser(ticketId, file)
      const res = await fetch(`/api/admin/reswell-tickets/${ticketId}/files`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'image', url, label: file.name }),
      })
      const body = await readJson(res)
      if (!res.ok) throw new Error(errorMessage(body, 'Could not save image'))
      const saved = (body as { data: ReswellTicketFile }).data
      replacePending(saved)
      void fetch(`/api/admin/reswell-tickets/${ticketId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ descriptionImageUrl: saved.url }),
      })
    } catch {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(`/api/admin/reswell-tickets/${ticketId}/description-image`, {
        method: 'POST',
        credentials: 'include',
        body: form,
      })
      const body = await readJson(res)
      if (!res.ok) {
        replacePending(null)
        toast.error(errorMessage(body, 'Could not upload image'))
        return
      }
      replacePending((body as { data: { file: ReswellTicketFile } }).data.file)
    }
  }, [currentUserId])

  const visibleTickets = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = tickets.filter((ticket) => {
      if (view === 'mine' && !ticket.assignees.some((person) => person.id === currentUserId)) {
        return false
      }
      if (view === 'open' && !isOpenStatus(ticket.status)) return false
      if (view === 'done' && ticket.status !== 'done') return false
      if (!q) return true
      return (
        ticket.title.toLowerCase().includes(q) ||
        ticket.description.toLowerCase().includes(q)
      )
    })

    const sorted = [...filtered]
    sorted.sort((a, b) => {
      if (sort === 'title') return a.title.localeCompare(b.title)
      if (sort === 'status') return a.status.localeCompare(b.status)
      if (sort === 'due') {
        if (!a.dueDate && !b.dueDate) return 0
        if (!a.dueDate) return 1
        if (!b.dueDate) return -1
        return a.dueDate.localeCompare(b.dueDate)
      }
      return b.createdAt.localeCompare(a.createdAt)
    })
    return sorted
  }, [currentUserId, query, sort, tickets, view])

  const selectedTicket = tickets.find((ticket) => ticket.id === selectedId) ?? null

  const toggleChecked = useCallback((id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  return {
    tickets,
    staff,
    currentUserId,
    loading,
    error,
    view,
    setView,
    query,
    setQuery,
    sort,
    setSort,
    selectedId,
    setSelectedId,
    selectedTicket,
    checkedIds,
    toggleChecked,
    visibleTickets,
    createTicket,
    updateTicket,
    deleteTicket,
    addComment,
    deleteComment,
    addSubtask,
    updateSubtask,
    deleteSubtask,
    addFile,
    deleteFile,
    uploadDescriptionImage,
  }
}
