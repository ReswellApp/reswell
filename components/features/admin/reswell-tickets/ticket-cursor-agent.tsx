'use client'

import { useEffect, useRef, useState } from 'react'
import { ExternalLink, Loader2, RefreshCw } from 'lucide-react'
import { Input } from '@/components/ui/input'
import type { ReswellTicket } from '@/lib/types/reswellTickets'
import {
  cursorRunStatusLabel,
  isReswellTicketCursorBusy,
} from '@/lib/utils/reswellTicketCursorState'

interface TicketCursorAgentProps {
  ticket: ReswellTicket
  busy: boolean
  onDispatch: (force?: boolean) => Promise<void>
  onSync: (silent?: boolean) => Promise<void>
  onFollowUp: (text: string) => Promise<void>
}

export function TicketCursorAgent({
  ticket,
  busy,
  onDispatch,
  onSync,
  onFollowUp,
}: TicketCursorAgentProps) {
  const agent = ticket.cursorAgent
  const working = isReswellTicketCursorBusy(agent)
  const untitled = ticket.title.trim().length < 2
  const [followUp, setFollowUp] = useState('')

  const agentId = agent?.agentId ?? null
  const onSyncRef = useRef(onSync)
  onSyncRef.current = onSync

  useEffect(() => {
    if (!agentId) return
    void onSyncRef.current(true)
    if (!working) return
    const timer = window.setInterval(() => {
      void onSyncRef.current(true)
    }, 20_000)
    return () => window.clearInterval(timer)
  }, [agentId, ticket.id, working])

  return (
    <section className="rounded-lg border border-neutral-200 p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-neutral-800">Cursor agent</h3>
        {agent ? (
          <button
            type="button"
            onClick={() => void onSync()}
            disabled={busy}
            className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-800 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Refresh
          </button>
        ) : null}
      </div>

      {agent ? (
        <div className="mt-2 space-y-2 text-sm">
          <p className="text-neutral-600">
            {working ? 'Working this ticket' : cursorRunStatusLabel(agent.runStatus)}
            {agent.agentStatus === 'ARCHIVED' ? ' · archived' : ''}
          </p>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
            {agent.agentUrl ? (
              <a
                href={agent.agentUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[#2383e2] hover:underline"
              >
                Open agent
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : null}
            {agent.prUrl ? (
              <a
                href={agent.prUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[#2383e2] hover:underline"
              >
                Open pull request
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : null}
          </div>
          {agent.agentStatus !== 'ARCHIVED' ? (
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault()
                if (!followUp.trim()) return
                void onFollowUp(followUp.trim()).then(() => setFollowUp(''))
              }}
            >
              <Input
                value={followUp}
                onChange={(event) => setFollowUp(event.target.value)}
                placeholder="Send a follow-up…"
                className="h-8 text-sm"
                disabled={busy}
              />
              <button
                type="submit"
                disabled={busy || !followUp.trim()}
                className="text-sm text-[#2383e2] disabled:opacity-50"
              >
                Send
              </button>
            </form>
          ) : null}
          <button
            type="button"
            onClick={() => void onDispatch(true)}
            disabled={busy || untitled}
            className="text-xs text-neutral-500 hover:text-neutral-800 disabled:opacity-50"
          >
            Start a new agent
          </button>
        </div>
      ) : (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => void onDispatch()}
            disabled={busy || untitled}
            className="inline-flex items-center gap-2 rounded-md bg-[#2383e2] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#1b76d2] disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Send to Cursor
          </button>
          {untitled ? (
            <p className="mt-2 text-xs text-neutral-500">Add a title first.</p>
          ) : (
            <p className="mt-2 text-xs text-neutral-500">
              Launches a Cloud Agent on this repo with the ticket as the prompt.
            </p>
          )}
        </div>
      )}
    </section>
  )
}
