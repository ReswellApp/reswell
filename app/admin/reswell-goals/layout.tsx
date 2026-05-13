import { privatePageMetadata } from '@/lib/site-metadata'

export const metadata = privatePageMetadata({
  title: 'Reswell goals — Reswell admin',
  description: 'Site visitors and page views by period.',
  path: '/admin/reswell-goals',
})

export default function ReswellGoalsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
