'use client'

import { useEffect, useState } from 'react'
import { FileText, Figma, Link2, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import type {
  ReswellTicket,
  ReswellTicketFileKind,
  ReswellTicketStaff,
} from '@/lib/types/reswellTickets'
import { StaffAvatar } from './staff-avatar'
import { TicketDescriptionDropzone } from './ticket-description-dropzone'
import { FILE_KIND_META } from './ticket-ui'

interface PeekSectionsProps {
  ticket: ReswellTicket
  currentUser: ReswellTicketStaff | null
  onDescriptionChange: (description: string) => void
  onAddComment: (body: string) => void
  onDeleteComment: (id: string) => void
  onAddSubtask: () => void
  onUpdateSubtask: (patch: { id: string; title?: string; completed?: boolean }) => void
  onDeleteSubtask: (id: string) => void
  onAddFile: (input: { kind: ReswellTicketFileKind; url: string }) => void
  onDeleteFile: (id: string) => void
  onUploadImages: (files: File[]) => Promise<void>
}

export function TicketPeekSections({
  ticket,
  currentUser,
  onDescriptionChange,
  onAddComment,
  onDeleteComment,
  onAddSubtask,
  onUpdateSubtask,
  onDeleteSubtask,
  onAddFile,
  onDeleteFile,
  onUploadImages,
}: PeekSectionsProps) {
  const [comment, setComment] = useState('')
  const [description, setDescription] = useState(ticket.description)
  const [fileKind, setFileKind] = useState<ReswellTicketFileKind | null>(null)
  const [fileUrl, setFileUrl] = useState('')
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    setDescription(ticket.description)
  }, [ticket.id, ticket.description])

  return (
    <div className="space-y-8">
      <section>
        <h3 className="mb-3 text-sm font-semibold text-neutral-800">Comments</h3>
        <div className="space-y-3">
          {ticket.comments.map((item) => (
            <div key={item.id} className="flex gap-2">
              {item.author ? <StaffAvatar person={item.author} size="sm" /> : (
                <div className="h-6 w-6 rounded-full bg-neutral-200" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs text-neutral-500">{item.author?.name ?? 'Teammate'}</p>
                <p className="whitespace-pre-wrap text-sm text-neutral-800">{item.body}</p>
              </div>
              <button
                type="button"
                onClick={() => onDeleteComment(item.id)}
                className="text-neutral-400 hover:text-neutral-700"
                aria-label="Delete comment"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <div className="flex items-center gap-2">
            {currentUser ? <StaffAvatar person={currentUser} size="sm" /> : (
              <div className="h-6 w-6 rounded-full bg-neutral-200" />
            )}
            <Input
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Add a comment..."
              className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
              onKeyDown={(event) => {
                if (event.key === 'Enter' && comment.trim()) {
                  event.preventDefault()
                  void onAddComment(comment.trim())
                  setComment('')
                }
              }}
            />
          </div>
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-neutral-800">Task description</h3>
        <TicketDescriptionDropzone
          description={description}
          images={ticket.files.filter((file) => file.kind === 'image')}
          uploading={uploading}
          onDescriptionChange={setDescription}
          onDescriptionBlur={() => {
            if (description !== ticket.description) onDescriptionChange(description)
          }}
          onDropImages={(files) => {
            setUploading(true)
            void onUploadImages(files).finally(() => setUploading(false))
          }}
          onRemoveImage={onDeleteFile}
        />
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-neutral-800">Sub-tasks</h3>
        <div className="space-y-2">
          {ticket.subtasks.map((item) => (
            <div key={item.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={item.completed}
                onChange={(event) =>
                  onUpdateSubtask({ id: item.id, completed: event.target.checked })
                }
                className="h-4 w-4 rounded border-neutral-300"
              />
              <input
                defaultValue={item.title}
                onBlur={(event) => {
                  if (event.target.value !== item.title) {
                    onUpdateSubtask({ id: item.id, title: event.target.value })
                  }
                }}
                placeholder="To-do"
                className="h-7 flex-1 border-0 bg-transparent text-sm outline-none"
              />
              <button
                type="button"
                onClick={() => onDeleteSubtask(item.id)}
                className="text-neutral-300 hover:text-neutral-600"
                aria-label="Delete sub-task"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={onAddSubtask}
            className="flex items-center gap-2 text-sm text-neutral-400 hover:text-neutral-700"
          >
            <span className="inline-block h-4 w-4 rounded border border-neutral-300" />
            To-do
          </button>
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-neutral-800">Supporting files</h3>
        <div className="space-y-2">
          {ticket.files.filter((file) => file.kind !== 'image').map((file) => (
            <a
              key={file.id}
              href={file.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between rounded-lg border border-neutral-200 px-3 py-2 text-sm hover:bg-neutral-50"
            >
              <span className="truncate">{file.label}</span>
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault()
                  onDeleteFile(file.id)
                }}
                className="text-neutral-400 hover:text-neutral-700"
                aria-label="Remove file"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </a>
          ))}
          <div className="grid gap-2">
            {(['pdf', 'drive', 'figma'] as const).map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => setFileKind(kind)}
                className="flex items-center gap-3 rounded-lg border border-neutral-200 px-3 py-2.5 text-left text-sm hover:bg-neutral-50"
              >
                {kind === 'pdf' ? <FileText className="h-4 w-4 text-red-500" /> : null}
                {kind === 'drive' ? <Link2 className="h-4 w-4 text-yellow-500" /> : null}
                {kind === 'figma' ? <Figma className="h-4 w-4 text-neutral-800" /> : null}
                <span>
                  <span className="block font-medium text-neutral-800">{FILE_KIND_META[kind].label}</span>
                  {kind === 'drive' ? (
                    <span className="block text-xs text-neutral-500">
                      Connect Google Drive to embed a file
                    </span>
                  ) : null}
                </span>
              </button>
            ))}
          </div>
          {fileKind ? (
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault()
                if (!fileUrl.trim()) return
                onAddFile({ kind: fileKind, url: fileUrl.trim() })
                setFileUrl('')
                setFileKind(null)
              }}
            >
              <Input
                value={fileUrl}
                onChange={(event) => setFileUrl(event.target.value)}
                placeholder={FILE_KIND_META[fileKind].hint}
                className="h-8 text-sm"
              />
              <button type="submit" className="text-sm text-[#2383e2]">
                Add
              </button>
            </form>
          ) : null}
        </div>
      </section>
    </div>
  )
}
