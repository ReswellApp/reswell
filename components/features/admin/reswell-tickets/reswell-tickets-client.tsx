'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import {
  ArrowUpDown,
  CheckCircle2,
  ChevronDown,
  Clock,
  Filter,
  Loader2,
  Search,
  Star,
  User,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { RESWELL_TICKET_VIEWS, type ReswellTicketView } from '@/lib/types/reswellTickets'
import { useReswellTickets, type TicketSortKey } from './hooks/use-reswell-tickets'
import { ResizableWorkspace } from './resizable-workspace'
import { TicketPeek } from './ticket-peek'
import { TicketsTable } from './tickets-table'
import { TICKET_VIEW_META } from './ticket-ui'

const VIEW_ICONS = {
  star: Star,
  clock: Clock,
  person: User,
} as const

const SORT_OPTIONS: { key: TicketSortKey; label: string }[] = [
  { key: 'created', label: 'Created' },
  { key: 'due', label: 'Due date' },
  { key: 'title', label: 'Task name' },
  { key: 'status', label: 'Status' },
]

export function ReswellTicketsClient() {
  const state = useReswellTickets()
  const [searchOpen, setSearchOpen] = useState(false)
  const selected = state.selectedTicket

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') state.setSelectedId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state.setSelectedId])

  return (
    <ResizableWorkspace>
      <div className="flex min-h-[42rem] items-stretch">
        <div className="min-w-0 flex-1">
          <div className="relative h-48 w-full overflow-hidden sm:h-56">
            <Image
              src="/images/home/hero-backdrop-tahiti.jpg"
              alt=""
              fill
              priority
              className="object-cover object-center"
            />
          </div>

          <div className="px-6 pb-8 sm:px-10">
            <div className="relative z-10 mb-3 pt-5 text-4xl leading-none" aria-hidden>
              🏄
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-neutral-900">Reswell Tickets</h1>
            <p className="mt-2 max-w-xl text-sm text-neutral-500">
              Internal admin board for progress and bug fixes. Not the support inbox.
            </p>

            <section className="mt-10">
              <div className="mb-3 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" aria-hidden />
                <h2 className="text-lg font-semibold text-neutral-800">Tasks Tracker</h2>
              </div>

              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 border-b border-[#e9e9e7]">
                <div className="flex flex-wrap items-center gap-1">
                  {RESWELL_TICKET_VIEWS.map((view) => (
                    <ViewTab
                      key={view}
                      view={view}
                      active={state.view === view}
                      onClick={() => state.setView(view)}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-1 pb-1">
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="rounded p-1.5 text-neutral-500 hover:bg-neutral-100"
                        aria-label="Filter"
                      >
                        <Filter className="h-4 w-4" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-44 p-1">
                      {RESWELL_TICKET_VIEWS.map((view) => (
                        <button
                          key={view}
                          type="button"
                          onClick={() => state.setView(view)}
                          className={cn(
                            'flex w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-neutral-100',
                            state.view === view && 'bg-neutral-50',
                          )}
                        >
                          {TICKET_VIEW_META[view].label}
                        </button>
                      ))}
                    </PopoverContent>
                  </Popover>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="rounded p-1.5 text-neutral-500 hover:bg-neutral-100"
                        aria-label="Sort"
                      >
                        <ArrowUpDown className="h-4 w-4" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-40 p-1">
                      {SORT_OPTIONS.map((option) => (
                        <button
                          key={option.key}
                          type="button"
                          onClick={() => state.setSort(option.key)}
                          className={cn(
                            'flex w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-neutral-100',
                            state.sort === option.key && 'bg-neutral-50',
                          )}
                        >
                          {option.label}
                        </button>
                      ))}
                    </PopoverContent>
                  </Popover>
                  <button
                    type="button"
                    className="rounded p-1.5 text-neutral-500 hover:bg-neutral-100"
                    aria-label="Search"
                    onClick={() => setSearchOpen((open) => !open)}
                  >
                    <Search className="h-4 w-4" />
                  </button>
                  <div className="ml-1 inline-flex overflow-hidden rounded">
                    <button
                      type="button"
                      onClick={() => void state.createTicket()}
                      className="bg-[#2383e2] px-2.5 py-1 text-sm font-medium text-white hover:bg-[#1b76d2]"
                    >
                      New
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="border-l border-white/20 bg-[#2383e2] px-1.5 text-white hover:bg-[#1b76d2]"
                          aria-label="More new actions"
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => void state.createTicket()}>
                          New task
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>

              {searchOpen ? (
                <Input
                  value={state.query}
                  onChange={(event) => state.setQuery(event.target.value)}
                  placeholder="Search tasks..."
                  className="mb-3 h-8 max-w-sm text-sm"
                  autoFocus
                />
              ) : null}

              {state.error ? (
                <p className="py-6 text-sm text-red-600" role="alert">
                  {state.error}
                </p>
              ) : null}

              {state.loading ? (
                <p className="flex items-center gap-2 py-10 text-sm text-neutral-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading tasks…
                </p>
              ) : (
                <TicketsTable
                  tickets={state.visibleTickets}
                  staff={state.staff}
                  currentUserId={state.currentUserId}
                  selectedId={state.selectedId}
                  checkedIds={state.checkedIds}
                  groupByStatus={state.view === 'by_status'}
                  onToggleChecked={state.toggleChecked}
                  onOpen={state.setSelectedId}
                  onClose={() => state.setSelectedId(null)}
                  onUpdate={(id, patch) => void state.updateTicket(id, patch)}
                  onCreate={() => void state.createTicket()}
                />
              )}
            </section>
          </div>
        </div>

        {selected ? (
          <div className="hidden lg:block">
            <TicketPeek
              ticket={selected}
              staff={state.staff}
              currentUserId={state.currentUserId}
              onUpdate={(patch) => void state.updateTicket(selected.id, patch)}
              onDelete={() => void state.deleteTicket(selected.id)}
              onAddComment={(body) => void state.addComment(selected.id, body)}
              onDeleteComment={(id) => void state.deleteComment(selected.id, id)}
              onAddSubtask={() => void state.addSubtask(selected.id)}
              onUpdateSubtask={(patch) => void state.updateSubtask(selected.id, patch)}
              onDeleteSubtask={(id) => void state.deleteSubtask(selected.id, id)}
              onAddFile={(input) => void state.addFile(selected.id, input)}
              onDeleteFile={(id) => void state.deleteFile(selected.id, id)}
              onUploadImages={async (files) => {
                await Promise.all(
                  files.map((file) => state.uploadDescriptionImage(selected.id, file)),
                )
              }}
              onClose={() => state.setSelectedId(null)}
            />
          </div>
        ) : null}
      </div>

      {selected ? (
        <div className="fixed inset-0 z-50 bg-white lg:hidden">
          <TicketPeek
            ticket={selected}
            staff={state.staff}
            currentUserId={state.currentUserId}
            onUpdate={(patch) => void state.updateTicket(selected.id, patch)}
            onDelete={() => void state.deleteTicket(selected.id)}
            onAddComment={(body) => void state.addComment(selected.id, body)}
            onDeleteComment={(id) => void state.deleteComment(selected.id, id)}
            onAddSubtask={() => void state.addSubtask(selected.id)}
            onUpdateSubtask={(patch) => void state.updateSubtask(selected.id, patch)}
            onDeleteSubtask={(id) => void state.deleteSubtask(selected.id, id)}
            onAddFile={(input) => void state.addFile(selected.id, input)}
            onDeleteFile={(id) => void state.deleteFile(selected.id, id)}
            onUploadImages={async (files) => {
              await Promise.all(
                files.map((file) => state.uploadDescriptionImage(selected.id, file)),
              )
            }}
            onClose={() => state.setSelectedId(null)}
          />
        </div>
      ) : null}
    </ResizableWorkspace>
  )
}

function ViewTab({
  view,
  active,
  onClick,
}: {
  view: ReswellTicketView
  active: boolean
  onClick: () => void
}) {
  const meta = TICKET_VIEW_META[view]
  const Icon = VIEW_ICONS[meta.icon]
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        '-mb-px inline-flex items-center gap-1.5 border-b-2 px-2.5 py-2 text-sm',
        active
          ? 'border-neutral-800 font-medium text-neutral-900'
          : 'border-transparent text-neutral-500 hover:text-neutral-800',
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {meta.label}
    </button>
  )
}

