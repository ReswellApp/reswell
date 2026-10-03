import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { ReswellTicketCursorAgent } from '../types/reswellTickets.ts'
import {
  cursorRunStatusLabel,
  isReswellTicketCursorBusy,
} from './reswellTicketCursorState.ts'

function agent(
  overrides: Partial<ReswellTicketCursorAgent> = {},
): ReswellTicketCursorAgent {
  return {
    agentId: 'bc-1',
    agentUrl: 'https://cursor.com/agents/bc-1',
    agentStatus: 'IDLE',
    runId: 'run-1',
    runStatus: 'FINISHED',
    prUrl: null,
    lastSyncedAt: null,
    ...overrides,
  }
}

describe('reswell ticket cursor state', () => {
  it('treats an active agent or in-flight run as busy', () => {
    assert.equal(isReswellTicketCursorBusy(null), false)
    assert.equal(isReswellTicketCursorBusy(agent()), false)
    assert.equal(isReswellTicketCursorBusy(agent({ agentStatus: 'ACTIVE' })), true)
    assert.equal(
      isReswellTicketCursorBusy(agent({ agentStatus: 'IDLE', runStatus: 'RUNNING' })),
      true,
    )
  })

  it('labels run statuses for the ticket UI', () => {
    assert.equal(cursorRunStatusLabel('RUNNING'), 'Working')
    assert.equal(cursorRunStatusLabel('FINISHED'), 'Finished')
    assert.equal(cursorRunStatusLabel(null), 'Unknown')
  })
})
