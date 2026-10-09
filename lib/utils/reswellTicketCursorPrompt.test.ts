import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { ReswellTicket } from '../types/reswellTickets.ts'
import {
  buildReswellTicketCursorPrompt,
  collectReswellTicketCursorImageUrls,
} from './reswellTicketCursorPrompt.ts'

function ticket(overrides: Partial<ReswellTicket> = {}): ReswellTicket {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    title: 'Fix checkout tax',
    status: 'not_started',
    dueDate: null,
    priority: 'high',
    taskType: 'bug',
    effortLevel: 's',
    description: 'Sales tax is missing on CA orders.',
    descriptionImageUrl: 'https://example.com/cover.png',
    assignees: [],
    comments: [
      {
        id: 'c1',
        ticketId: '11111111-1111-4111-8111-111111111111',
        authorId: null,
        author: { id: 'u1', name: 'Hayden', email: null, avatarUrl: null },
        body: 'Repro on /checkout.',
        createdAt: '2026-09-14T00:00:00.000Z',
      },
      {
        id: 'c2',
        ticketId: '11111111-1111-4111-8111-111111111111',
        authorId: null,
        author: null,
        body: 'Sent to Cursor Cloud Agent.\nhttps://cursor.com/agents/bc-1',
        createdAt: '2026-09-14T00:01:00.000Z',
      },
    ],
    subtasks: [
      {
        id: 's1',
        ticketId: '11111111-1111-4111-8111-111111111111',
        title: 'Add CA fixture',
        completed: false,
        sortOrder: 0,
        createdAt: '2026-09-14T00:00:00.000Z',
      },
      {
        id: 's2',
        ticketId: '11111111-1111-4111-8111-111111111111',
        title: '',
        completed: false,
        sortOrder: 1,
        createdAt: '2026-09-14T00:00:00.000Z',
      },
    ],
    files: [
      {
        id: 'f1',
        ticketId: '11111111-1111-4111-8111-111111111111',
        kind: 'image',
        label: 'Screenshot',
        url: 'https://example.com/shot.png',
        createdBy: null,
        createdAt: '2026-09-14T00:00:00.000Z',
      },
      {
        id: 'f2',
        ticketId: '11111111-1111-4111-8111-111111111111',
        kind: 'figma',
        label: 'Tax UI',
        url: 'https://www.figma.com/file/abc',
        createdBy: null,
        createdAt: '2026-09-14T00:00:00.000Z',
      },
    ],
    cursorAgent: null,
    createdBy: null,
    createdAt: '2026-09-14T00:00:00.000Z',
    updatedAt: '2026-09-14T00:00:00.000Z',
    ...overrides,
  }
}

describe('reswell ticket cursor prompt', () => {
  it('includes ticket fields and skips empty subtasks and system comments', () => {
    const prompt = buildReswellTicketCursorPrompt(ticket())
    assert.match(prompt, /Ticket ID: 11111111-1111-4111-8111-111111111111/)
    assert.match(prompt, /Title: Fix checkout tax/)
    assert.match(prompt, /Type: bug/)
    assert.match(prompt, /Sales tax is missing on CA orders/)
    assert.match(prompt, /\[ \] Add CA fixture/)
    assert.match(prompt, /Hayden: Repro on \/checkout/)
    assert.match(prompt, /figma Tax UI: https:\/\/www\.figma\.com\/file\/abc/)
    assert.doesNotMatch(prompt, /Sent to Cursor Cloud Agent/)
    assert.doesNotMatch(prompt, /\[ \] $/)
  })

  it('collects unique http image urls with a cap of five', () => {
    const urls = collectReswellTicketCursorImageUrls(
      ticket({
        files: [
          {
            id: 'f1',
            ticketId: 't',
            kind: 'image',
            label: 'A',
            url: 'https://example.com/cover.png',
            createdBy: null,
            createdAt: '2026-09-14T00:00:00.000Z',
          },
          {
            id: 'f2',
            ticketId: 't',
            kind: 'image',
            label: 'B',
            url: 'https://example.com/two.png',
            createdBy: null,
            createdAt: '2026-09-14T00:00:00.000Z',
          },
          {
            id: 'f3',
            ticketId: 't',
            kind: 'figma',
            label: 'Skip',
            url: 'https://www.figma.com/file/abc',
            createdBy: null,
            createdAt: '2026-09-14T00:00:00.000Z',
          },
        ],
      }),
    )
    assert.deepEqual(urls, ['https://example.com/cover.png', 'https://example.com/two.png'])
  })
})
