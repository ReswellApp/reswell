"use client"

import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { applyEmailStudioCommandsAction } from "@/lib/actions/emailStudioCommands"
import type { EmailStudioRecord } from "@/lib/types/emailStudio"
import type {
  EmailStudioEmailCommand,
  EmailStudioEmailSnapshot,
} from "@/lib/types/emailStudioCommands"

const AUTOSAVE_DELAY_MS = 1_200
const HISTORY_GROUP_MS = 700
const MAX_HISTORY = 50

function snapshot(record: EmailStudioRecord): EmailStudioEmailSnapshot {
  return {
    name: record.name,
    subject: record.subject,
    previewText: record.previewText,
    flowName: record.flowName,
    flowId: record.flowId,
    triggerMetric: record.triggerMetric,
    notes: record.notes,
    document: structuredClone(record.document),
  }
}

function snapshotKey(record: EmailStudioRecord): string {
  return JSON.stringify(snapshot(record))
}

function saveCommands(record: EmailStudioRecord): EmailStudioEmailCommand[] {
  const current = snapshot(record)
  const { document, ...patch } = current
  return [
    { type: "email.meta.patch", patch },
    { type: "email.document.replace", document },
  ]
}

export function useEmailStudioDocument(initial: EmailStudioRecord) {
  const backupKey = `email-studio:email:${initial.id}`
  const [draft, setDraftState] = useState(initial)
  const [dirty, setDirtyState] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [autosavePaused, setAutosavePaused] = useState(false)
  const [conflict, setConflict] = useState(false)
  const [historyVersion, setHistoryVersion] = useState(0)
  const draftRef = useRef(initial)
  const dirtyRef = useRef(false)
  const savePromiseRef = useRef<Promise<boolean> | null>(null)
  const inFlightRef = useRef<{ baseRevision: number; snapshotKey: string } | null>(null)
  const pastRef = useRef<EmailStudioEmailSnapshot[]>([])
  const futureRef = useRef<EmailStudioEmailSnapshot[]>([])
  const lastHistoryRef = useRef<{ key: string; at: number } | null>(null)

  function setDraft(next: EmailStudioRecord): void {
    draftRef.current = next
    setDraftState(next)
  }

  function setDirty(next: boolean): void {
    dirtyRef.current = next
    setDirtyState(next)
  }

  function persistBackup(record: EmailStudioRecord): void {
    try {
      sessionStorage.setItem(backupKey, JSON.stringify({
        revision: record.revision,
        snapshot: snapshot(record),
        inFlight: inFlightRef.current,
      }))
    } catch {
      // The server revision history remains the primary recovery path.
    }
  }

  function clearBackup(): void {
    try {
      sessionStorage.removeItem(backupKey)
    } catch {
      // Storage can be unavailable in hardened browser contexts.
    }
  }

  function remember(current: EmailStudioRecord, historyKey: string): void {
    const now = Date.now()
    const previous = lastHistoryRef.current
    if (!previous || previous.key !== historyKey || now - previous.at > HISTORY_GROUP_MS) {
      pastRef.current = [...pastRef.current.slice(-(MAX_HISTORY - 1)), snapshot(current)]
      futureRef.current = []
      setHistoryVersion((value) => value + 1)
    }
    lastHistoryRef.current = { key: historyKey, at: now }
  }

  function patch(
    next: Partial<EmailStudioRecord> | ((current: EmailStudioRecord) => Partial<EmailStudioRecord>),
    historyKey = "edit",
  ): void {
    const current = draftRef.current
    remember(current, historyKey)
    const resolved = typeof next === "function" ? next(current) : next
    const updated = { ...current, ...resolved }
    setDraft(updated)
    persistBackup(updated)
    setDirty(true)
    setSaveError(null)
    setAutosavePaused(false)
    setConflict(false)
  }

  function applySnapshot(next: EmailStudioEmailSnapshot): void {
    const current = draftRef.current
    const updated = { ...current, ...structuredClone(next) }
    setDraft(updated)
    persistBackup(updated)
    setDirty(true)
    setSaveError(null)
    setAutosavePaused(false)
    lastHistoryRef.current = null
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

  function reset(next: EmailStudioRecord): void {
    pastRef.current = []
    futureRef.current = []
    lastHistoryRef.current = null
    setDraft(next)
    setDirty(false)
    setSaveError(null)
    setAutosavePaused(false)
    setConflict(false)
    setHistoryVersion((value) => value + 1)
    clearBackup()
  }

  function mergeServerFields(fields: Partial<EmailStudioRecord>): void {
    setDraft({ ...draftRef.current, ...fields })
  }

  async function save(options: { announce?: boolean; flush?: boolean } = {}): Promise<boolean> {
    if (conflict) {
      if (options.announce) toast.error("Reload before saving; this email changed elsewhere.")
      return false
    }
    if (savePromiseRef.current) {
      const priorSaved = await savePromiseRef.current
      if (!priorSaved || !options.flush || !dirtyRef.current) return priorSaved
    }
    if (!dirtyRef.current) {
      if (options.announce) toast.success("Saved")
      return true
    }

    const captured = draftRef.current
    const capturedKey = snapshotKey(captured)
    inFlightRef.current = { baseRevision: captured.revision, snapshotKey: capturedKey }
    persistBackup(captured)
    const task = (async () => {
      setSaving(true)
      try {
        const result = await applyEmailStudioCommandsAction({
          scope: "email",
          scopeId: captured.id,
          expectedRevision: captured.revision,
          summary: options.announce ? "Saved email" : "Autosaved email",
          commands: saveCommands(captured),
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
        if (result.scope !== "email") {
          inFlightRef.current = null
          persistBackup(draftRef.current)
          setSaveError("The studio returned the wrong project type.")
          setAutosavePaused(true)
          return false
        }

        const current = draftRef.current
        const unchanged = snapshotKey(current) === capturedKey
        const next = unchanged
          ? result.data
          : {
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
    savePromiseRef.current = task
    let saved = false
    try {
      saved = await task
    } finally {
      savePromiseRef.current = null
    }
    if (saved && options.flush && dirtyRef.current) return save(options)
    return saved
  }

  useEffect(() => {
    if (!dirty || saving || conflict || autosavePaused) return
    const timer = window.setTimeout(() => {
      void save()
    }, AUTOSAVE_DELAY_MS)
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
      const restored = parsed.snapshot as EmailStudioEmailSnapshot
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
    if (dirtyRef.current || initial.updatedAt === draftRef.current.updatedAt) return
    setDraft(initial)
  }, [initial])

  return {
    draft,
    patch,
    save,
    dirty,
    saving,
    saveError,
    conflict,
    undo,
    redo,
    reset,
    mergeServerFields,
    getCurrent: () => draftRef.current,
    canUndo: historyVersion >= 0 && pastRef.current.length > 0,
    canRedo: historyVersion >= 0 && futureRef.current.length > 0,
  }
}
