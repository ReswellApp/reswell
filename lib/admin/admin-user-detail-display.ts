import { capitalizeWords } from '@/lib/listing-labels'

type StatusTone = 'green' | 'amber' | 'blue' | 'red' | 'violet' | 'slate'

export function formatAdminUsd(amount: number): string {
  return amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function adminListingStatusPill(status: string): { label: string; tone: StatusTone } {
  switch (status) {
    case 'active':
      return { label: 'Active', tone: 'green' }
    case 'sold':
      return { label: 'Sold', tone: 'blue' }
    case 'pending':
      return { label: 'Pending', tone: 'amber' }
    case 'pending_sale':
      return { label: 'Pending sale', tone: 'violet' }
    case 'draft':
      return { label: 'Draft', tone: 'slate' }
    case 'removed':
      return { label: 'Removed', tone: 'red' }
    case 'delinquent':
      return { label: 'Delinquent', tone: 'amber' }
    default:
      return { label: capitalizeWords(status.replace(/_/g, ' ')), tone: 'slate' }
  }
}

export function adminUserLocation(profile: {
  city: string | null
  location: string | null
}): string | null {
  const location = [profile.city, profile.location].filter(Boolean).join(', ')
  return location || null
}
