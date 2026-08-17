import { z } from 'zod'
import {
  RESWELL_TICKET_EFFORTS,
  RESWELL_TICKET_FILE_KINDS,
  RESWELL_TICKET_PRIORITIES,
  RESWELL_TICKET_STATUSES,
  RESWELL_TICKET_TYPES,
} from '@/lib/types/reswellTickets'

const optionalUrl = z
  .union([
    z.string().trim().url().max(2000),
    z.literal('').transform(() => null),
    z.null(),
  ])
  .optional()

export const updateReswellTicketSchema = z.object({
  title: z.string().max(300).optional(),
  status: z.enum(RESWELL_TICKET_STATUSES).optional(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
    .nullable()
    .optional(),
  priority: z.enum(RESWELL_TICKET_PRIORITIES).nullable().optional(),
  taskType: z.enum(RESWELL_TICKET_TYPES).nullable().optional(),
  effortLevel: z.enum(RESWELL_TICKET_EFFORTS).nullable().optional(),
  description: z.string().max(20000).optional(),
  descriptionImageUrl: optionalUrl,
  assigneeIds: z.array(z.string().uuid()).max(20).optional(),
})

export const createReswellTicketCommentSchema = z.object({
  body: z.string().trim().min(1, 'Comment cannot be empty').max(4000),
})

export const createReswellTicketSubtaskSchema = z.object({
  title: z.string().max(300).optional(),
})

export const updateReswellTicketSubtaskSchema = z.object({
  id: z.string().uuid(),
  title: z.string().max(300).optional(),
  completed: z.boolean().optional(),
})

export const deleteByIdSchema = z.object({
  id: z.string().uuid(),
})

export const createReswellTicketFileSchema = z.object({
  kind: z.enum(RESWELL_TICKET_FILE_KINDS),
  url: z.string().trim().url().max(2000),
  label: z.string().trim().max(200).optional(),
})

export type UpdateReswellTicketInput = z.infer<typeof updateReswellTicketSchema>
export type CreateReswellTicketCommentInput = z.infer<typeof createReswellTicketCommentSchema>
export type CreateReswellTicketSubtaskInput = z.infer<typeof createReswellTicketSubtaskSchema>
export type UpdateReswellTicketSubtaskInput = z.infer<typeof updateReswellTicketSubtaskSchema>
export type CreateReswellTicketFileInput = z.infer<typeof createReswellTicketFileSchema>
