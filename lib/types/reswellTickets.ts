export const RESWELL_TICKET_STATUSES = ['not_started', 'in_progress', 'done'] as const
export type ReswellTicketStatus = (typeof RESWELL_TICKET_STATUSES)[number]

export const RESWELL_TICKET_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const
export type ReswellTicketPriority = (typeof RESWELL_TICKET_PRIORITIES)[number]

export const RESWELL_TICKET_TYPES = ['feature', 'bug', 'ops', 'content', 'design', 'other'] as const
export type ReswellTicketType = (typeof RESWELL_TICKET_TYPES)[number]

export const RESWELL_TICKET_EFFORTS = ['xs', 's', 'm', 'l', 'xl'] as const
export type ReswellTicketEffort = (typeof RESWELL_TICKET_EFFORTS)[number]

export const RESWELL_TICKET_FILE_KINDS = ['pdf', 'drive', 'figma', 'image', 'link'] as const
export type ReswellTicketFileKind = (typeof RESWELL_TICKET_FILE_KINDS)[number]

export const RESWELL_TICKET_VIEWS = ['all', 'by_status', 'mine', 'open', 'done'] as const
export type ReswellTicketView = (typeof RESWELL_TICKET_VIEWS)[number]

export interface ReswellTicketStaff {
  id: string
  name: string
  email: string | null
  avatarUrl: string | null
}

export interface ReswellTicketComment {
  id: string
  ticketId: string
  authorId: string | null
  author: ReswellTicketStaff | null
  body: string
  createdAt: string
}

export interface ReswellTicketSubtask {
  id: string
  ticketId: string
  title: string
  completed: boolean
  sortOrder: number
  createdAt: string
}

export interface ReswellTicketFile {
  id: string
  ticketId: string
  kind: ReswellTicketFileKind
  label: string
  url: string
  createdBy: string | null
  createdAt: string
}

export interface ReswellTicket {
  id: string
  title: string
  status: ReswellTicketStatus
  dueDate: string | null
  priority: ReswellTicketPriority | null
  taskType: ReswellTicketType | null
  effortLevel: ReswellTicketEffort | null
  description: string
  descriptionImageUrl: string | null
  assignees: ReswellTicketStaff[]
  comments: ReswellTicketComment[]
  subtasks: ReswellTicketSubtask[]
  files: ReswellTicketFile[]
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export interface ReswellTicketsSnapshot {
  tickets: ReswellTicket[]
  staff: ReswellTicketStaff[]
  currentUserId: string
}

export const RESWELL_TICKET_LIST_SELECT =
  'id, title, status, due_date, priority, task_type, effort_level, description, description_image_url, created_by, created_at, updated_at' as const
