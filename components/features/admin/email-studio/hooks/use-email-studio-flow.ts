"use client"

import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { applyEmailStudioCommandsAction } from "@/lib/actions/emailStudioCommands"
import type {
  EmailStudioFlowCommand,
  EmailStudioFlowSnapshot,
} from "@/lib/types/emailStudioCommands"
import type {
  EmailStudioFlowDefinition,
  EmailStudioFlowRecord,
} from "@/lib/types/emailStudioFlow"

const AUTOSAVE_DELAY_MS = 1_200
const MAX_HISTORY = 50

function snapshot(record: EmailStudioFlowRecord): EmailStudioFlowSnapshot {
  return {
    name: record.name,
    notes: record.notes,
    definition: structuredClone(record.definition),
  }
}

function key(record: EmailStudioFlowRecord): string {
  return JSON.stringify(snapshot(record))
}

function commands(record: EmailStudioFlowRecord): EmailStudioFlowCommand[] {
  return [
    { type: "flow.meta.patch", patch: { name: record.name, notes: record.notes } },
    { type: "flow.definition.replace", definition: record.definition },
  ]
}

export function useEmailStudioFlow(initial: EmailStudioFlowRecord) {
  const backupKey = `email-studio:flow:${initial.id}`
  const [draft, setDraftState] = useState(initial)
  const [dirty, setDirtyState] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [autosavePaused, setAutosavePaused] = useState(false)
  const [conflict, setConflict] = useState(false)
  const [historyVersion, setHistoryVersion] = useState(0)
  const draftRef = useRef(initial)
  const dirtyRef = useRef(false)
  const savingRef = useRef<Promise<boolean> | null>(null)
  const inFlightRef = useRef<{ baseRevision: number; snapshotKey: string } | null>(null)
  const pastRef = useRef<EmailStudioFlowSnapshot[]>([])
  const futureRef = useRef<EmailStudioFlowSnapshot[]>([])

  function setDraft(next: EmailStudioFlowRecord): void {
    draftRef.current = next
    setDraftState(next)
  }

  function setDirty(next: boolean): void {
    dirtyRef.current = next
    setDirtyState(next)
  }

  function persistBackup(record: EmailStudioFlowRecord): void {
    try {
      sessionStorage.setItem(backupKey, JSON.stringify({
        revision: record.revision,
        snapshot: snapshot(record),
        inFlight: inFlightRef.current,
      }))
    } catch {
      // Server revision history remains the primary recovery path.
    }
  }

  function clearBackup(): void {
    try {
      sessionStorage.removeItem(backupKey)
    } catch {
      // Storage can be unavailable in hardened browser contexts.
    }
  }

  function change(next: Partial<EmailStudioFlowRecord>): void {
    pastRef.current = [...pastRef.current.slice(-(MAX_HISTORY - 1)), snapshot(draftRef.current)]
    futureRef.current = []
    setHistoryVersion((value) => value + 1)
    const updated = { ...draftRef.current, ...next }
    setDraft(updated)
    persistBackup(updated)
    setDirty(true)
    setSaveError(null)
    setAutosavePaused(false)
    setConflict(false)
  }

  function patchDefinition(definition: EmailStudioFlowDefinition): void {
    change({ definition })
  }

  function applySnapshot(next: EmailStudioFlowSnapshot): void {
    const updated = { ...draftRef.current, ...structuredClone(next) }
    setDraft(updated)
    persistBackup(updated)
    setDirty(true)
    setSaveError(null)
    setAutosavePaused(false)
    setHistoryVersion((value) => value + 1)
  }

  function undo(): void {
    const previous = pastRef.current.at(-1)
    if (!previous) return
    pastRef.current = pastRef.current.slice(0, -1)
    futureRef.current = [snapshot(draftRef.current), ...futureRef.current].slice(0, MAX_HISTORY)
    applySnapshot(previous)
  }

  function redo(): void {
    const next = futureRef.current[0]
    if (!next) return
    futureRef.current = futureRef.current.slice(1)
    pastRef.current = [...pastRef.current.slice(-(MAX_HISTORY - 1)), snapshot(draftRef.current)]
    applySnapshot(next)
  }

  function reset(next: EmailStudioFlowRecord): void {
    pastRef.current = []
    futureRef.current = []
    setDraft(next)
    setDirty(false)
    setSaveError(null)
    setAutosavePaused(false)
    setConflict(false)
    setHistoryVersion((value) => value + 1)
    clearBackup()
  }

  async function save(options: { announce?: boolean; flush?: boolean } = {}): Promise<boolean> {
    if (conflict) return false
    if (savingRef.current) {
      const saved = await savingRef.current
      if (!saved || !options.flush || !dirtyRef.current) return saved
    }
    if (!dirtyRef.current) return true
    const captured = draftRef.current
    const capturedKey = key(captured)
    inFlightRef.current = { baseRevision: captured.revision, snapshotKey: capturedKey }
    persistBackup(captured)
    const task = (async () => {
      setSaving(true)
      try {
        const result = await applyEmailStudioCommandsAction({
          scope: "flow",
          scopeId: captured.id,
          expectedRevision: captured.revision,
          summary: options.announce ? "Saved flow" : "Autosaved flow",
          commands: commands(captured),
        })
        if ("error" in result) {
          inFlightRef.current = null
          persistBackup(draftRef.current)
          setSaveError(result.error)
          setAutosavePaused(true)
          if (result.conflict) setConflict(true)
          if (options.announce) toast.error(result.error)
          return false
        }
        if (result.scope !== "flow") {
          inFlightRef.current = null
          persistBackup(draftRef.current)
          setSaveError("The studio returned the wrong flow type.")
          setAutosavePaused(true)
          return false
        }
        const current = draftRef.current
        const unchanged = key(current) === capturedKey
        const next = unchanged ? result.data : {
          ...current,
          revision: result.data.revision,
          updatedAt: result.data.updatedAt,
        }
        setDraft(next)
        setDirty(!unchanged)
        inFlightRef.current = null
        if (unchanged) clearBackup()
        else persistBackup(next)
        setSaveError(null)
        setAutosavePaused(false)
        if (options.announce && unchanged) toast.success("Saved")
        return true
      } catch (error) {
        const message = error instanceof Error ? error.message : "The save request failed."
        setSaveError(message)
        setAutosavePaused(true)
        if (options.announce) toast.error(message)
        return false
      } finally {
        setSaving(false)
      }
    })()
    savingRef.current = task
    let saved = false
    try {
      saved = await task
    } finally {
      savingRef.current = null
    }
    if (saved && options.flush && dirtyRef.current) return save(options)
    return saved
  }

  useEffect(() => {
    if (!dirty || saving || conflict || autosavePaused) return
    const timer = window.setTimeout(() => void save(), AUTOSAVE_DELAY_MS)
    return () => window.clearTimeout(timer)
  })

  useEffect(() => {
    function beforeUnload(event: BeforeUnloadEvent): void {
      if (!dirtyRef.current) return
      event.preventDefault()
    }
    window.addEventListener("beforeunload", beforeUnload)
    return () => window.removeEventListener("beforeunload", beforeUnload)
  }, [])

  useEffect(() => {
    if (dirtyRef.current) return
    try {
      const raw = sessionStorage.getItem(backupKey)
      if (!raw) return
      const parsed = JSON.parse(raw) as {
        revision?: unknown
        snapshot?: unknown
        inFlight?: { baseRevision?: unknown; snapshotKey?: unknown } | null
      }
      if (!parsed.snapshot || typeof parsed.snapshot !== "object") {
        clearBackup()
        return
      }
      const restored = parsed.snapshot as EmailStudioFlowSnapshot
      if (parsed.revision !== initial.revision) {
        const committedDuringNavigation =
          typeof parsed.inFlight?.baseRevision === "number"
          && parsed.inFlight.baseRevision + 1 === initial.revision
        if (!committedDuringNavigation) {
          clearBackup()
          return
        }
        if (
          typeof parsed.inFlight?.snapshotKey === "string"
          && JSON.stringify(restored) === parsed.inFlight.snapshotKey
        ) {
          clearBackup()
          return
        }
      }
      const recovered = { ...initial, ...restored }
      setDraft(recovered)
      persistBackup(recovered)
      setDirty(true)
    } catch {
      clearBackup()
    }
  }, [backupKey, initial])

  useEffect(() => {
    function saveBeforeNavigation(event: Event): void {
      const target = event.target as HTMLElement | null
      if (!target?.closest("a[href]") || !dirtyRef.current) return
      void save({ flush: true })
    }
    function saveBeforeHistoryNavigation(): void {
      if (dirtyRef.current) void save({ flush: true })
    }
    document.addEventListener("pointerdown", saveBeforeNavigation, true)
    document.addEventListener("click", saveBeforeNavigation, true)
    window.addEventListener("popstate", saveBeforeHistoryNavigation)
    return () => {
      document.removeEventListener("pointerdown", saveBeforeNavigation, true)
      document.removeEventListener("click", saveBeforeNavigation, true)
      window.removeEventListener("popstate", saveBeforeHistoryNavigation)
    }
  })

  useEffect(() => {
    if (dirtyRef.current || initial.revision <= draftRef.current.revision) return
    setDraft(initial)
  }, [initial])

  return {
    draft,
    change,
    patchDefinition,
    save,
    dirty,
    saving,
    saveError,
    conflict,
    undo,
    redo,
    reset,
    canUndo: historyVersion >= 0 && pastRef.current.length > 0,
    canRedo: historyVersion >= 0 && futureRef.current.length > 0,
    getCurrent: () => draftRef.current,
    mergeServerFields: (fields: Partial<EmailStudioFlowRecord>) => {
      setDraft({ ...draftRef.current, ...fields })
    },
  }
}
