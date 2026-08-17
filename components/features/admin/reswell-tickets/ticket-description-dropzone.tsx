'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { ImagePlus, Loader2, Trash2 } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { ReswellTicketFile } from '@/lib/types/reswellTickets'

interface TicketDescriptionDropzoneProps {
  description: string
  images: ReswellTicketFile[]
  uploading: boolean
  onDescriptionChange: (value: string) => void
  onDescriptionBlur: () => void
  onDropImages: (files: File[]) => void
  onRemoveImage: (id: string) => void
}

export function TicketDescriptionDropzone({
  description,
  images,
  uploading,
  onDescriptionChange,
  onDescriptionBlur,
  onDropImages,
  onRemoveImage,
}: TicketDescriptionDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragActive, setDragActive] = useState(false)

  function takeImages(list: FileList | File[] | null) {
    if (!list) return
    const files = Array.from(list).filter((file) => file.type.startsWith('image/'))
    if (files.length > 0) onDropImages(files)
  }

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault()
        setDragActive(true)
      }}
      onDragLeave={(event) => {
        event.preventDefault()
        setDragActive(false)
      }}
      onDrop={(event) => {
        event.preventDefault()
        setDragActive(false)
        takeImages(event.dataTransfer.files)
      }}
      className={cn(
        'rounded-lg border border-dashed border-transparent p-1 transition-colors',
        dragActive && 'border-[#2383e2] bg-blue-50/60',
      )}
    >
      {images.length > 0 ? (
        <div className="mb-3 grid grid-cols-1 gap-2">
          {images.map((image) => (
            <div key={image.id} className="group relative overflow-hidden rounded-md">
              <Image
                src={image.url}
                alt={image.label}
                width={800}
                height={400}
                unoptimized
                className={cn(
                  'max-h-56 w-full object-cover',
                  image.id.startsWith('pending-') && 'opacity-80',
                )}
              />
              <button
                type="button"
                onClick={() => onRemoveImage(image.id)}
                className="absolute right-2 top-2 rounded bg-white/90 p-1 text-neutral-500 opacity-0 shadow-sm hover:text-neutral-800 group-hover:opacity-100"
                aria-label={`Remove ${image.label}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <Textarea
        value={description}
        onChange={(event) => onDescriptionChange(event.target.value)}
        onBlur={onDescriptionBlur}
        placeholder="Provide an overview of the task and related details."
        className="min-h-24 border-0 px-0 shadow-none focus-visible:ring-0"
      />

      <div className="mt-1 flex items-center gap-2 text-xs text-neutral-400">
        {uploading ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Uploading…
          </>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-1 hover:text-neutral-700"
          >
            <ImagePlus className="h-3.5 w-3.5" />
            Drop images here or click to upload
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        className="hidden"
        onChange={(event) => {
          takeImages(event.target.files)
          event.target.value = ''
        }}
      />
    </div>
  )
}
