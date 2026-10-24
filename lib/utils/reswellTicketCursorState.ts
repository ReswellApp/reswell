import type { ReswellTicketCursorAgent } from '@/lib/types/reswellTickets'

export function isReswellTicketCursorBusy(
  agent: ReswellTicketCursorAgent | null | undefined,
): boolean {
  if (!agent) return false
  if (agent.agentStatus === 'ACTIVE') return true
  return agent.runStatus === 'CREATING' || agent.runStatus === 'RUNNING'
}

export function cursorRunStatusLabel(status: ReswellTicketCursorAgent['runStatus']): string {
  switch (status) {
    case 'CREATING':
      return 'Starting'
    case 'RUNNING':
      return 'Working'
    case 'FINISHED':
      return 'Finished'
    case 'ERROR':
      return 'Failed'
    case 'CANCELLED':
      return 'Cancelled'
    case 'EXPIRED':
      return 'Expired'
    default:
      return 'Unknown'
  }
}
