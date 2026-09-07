'use client'

import { useEffect, type ReactNode } from 'react'
import { Minimize2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  useResizableWorkspace,
  type WorkspaceCorner,
} from './hooks/use-resizable-workspace'

interface ResizableWorkspaceProps {
  children: ReactNode
}

const CORNERS: { corner: WorkspaceCorner; className: string; label: string }[] = [
  { corner: 'nw', className: 'left-1 top-1 cursor-nwse-resize', label: 'Resize from top left' },
  { corner: 'ne', className: 'right-1 top-1 cursor-nesw-resize', label: 'Resize from top right' },
  { corner: 'sw', className: 'bottom-1 left-1 cursor-nesw-resize', label: 'Resize from bottom left' },
  { corner: 'se', className: 'bottom-1 right-1 cursor-nwse-resize', label: 'Resize from bottom right' },
]

export function ResizableWorkspace({ children }: ResizableWorkspaceProps) {
  const { frameRef, rect, startResize, reset } = useResizableWorkspace()
  const expanded = rect !== null

  useEffect(() => {
    const main = frameRef.current?.closest('main')
    if (!(main instanceof HTMLElement)) return

    if (expanded) {
      main.style.background = 'transparent'
      main.style.borderColor = 'transparent'
      main.style.boxShadow = 'none'
    } else {
      main.style.background = ''
      main.style.borderColor = ''
      main.style.boxShadow = ''
    }

    return () => {
      main.style.background = ''
      main.style.borderColor = ''
      main.style.boxShadow = ''
    }
  }, [expanded, frameRef])

  return (
    <div
      ref={frameRef}
      className={cn(
        'relative overflow-hidden rounded-2xl bg-white',
        expanded
          ? 'fixed z-40 border border-neutral-200 shadow-2xl'
          : '-m-4 sm:-m-6',
      )}
      style={
        expanded
          ? {
              left: rect.left,
              top: rect.top,
              width: rect.width,
              height: rect.height,
            }
          : undefined
      }
    >
      <div className={cn('h-full', expanded && 'overflow-auto')}>{children}</div>

      {CORNERS.map(({ corner, className, label }) => (
        <button
          key={corner}
          type="button"
          aria-label={label}
          onPointerDown={(event) => startResize(corner, event)}
          onDoubleClick={reset}
          className={cn(
            'absolute z-20 flex h-4 w-4 items-center justify-center rounded-sm text-neutral-400 hover:text-neutral-700',
            className,
          )}
        >
          <span className="h-2.5 w-2.5 rounded-[2px] border-2 border-current bg-white shadow-sm" />
        </button>
      ))}

      {expanded ? (
        <button
          type="button"
          onClick={reset}
          className="absolute left-8 top-3 z-20 inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-white/90 px-2 py-1 text-xs font-medium text-neutral-600 shadow-sm hover:bg-white"
        >
          <Minimize2 className="h-3 w-3" />
          Fit
        </button>
      ) : null}
    </div>
  )
}
