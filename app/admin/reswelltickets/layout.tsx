import type { ReactNode } from 'react'
import { privatePageMetadata } from '@/lib/site-metadata'

export const metadata = privatePageMetadata({
  title: 'Reswell Tickets — Admin — Reswell',
  description: 'Internal admin tracker for progress and bug fixes. Not customer support.',
  path: '/admin/reswelltickets',
})

export default function ReswellTicketsLayout({
  children,
}: {
  children: ReactNode
}) {
  return children
}
