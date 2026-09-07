"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Film, Loader2, Square, Video } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  LISTING_VIDEO_RECORDER_AUDIO_BITS_PER_SECOND,
  LISTING_VIDEO_RECORDER_VIDEO_BITS_PER_SECOND,
  dispatchFileToInput,
  formatListingVideoRecorderClock,
  listingVideoRecorderMaxSeconds,
  listingVideoRecorderMinSeconds,
  listingVideoRecorderSupported,
  openListingVideoRecorderStream,
  pickListingVideoRecorderMime,
  stopListingVideoRecorderStream,
} from "@/lib/sell-flow/listing-video-recorder"

type Phase = "chooser" | "recording" | "review"

type SellListingVideoRecorderDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Hidden file input used for library picks + recorded File dispatch. */
  fileInputId: string
  /** Optional override when not wiring through the hidden input. */
  onFile?: (file: File) => void
}

export function SellListingVideoRecorderDialog({
  open,
  onOpenChange,
  fileInputId,
  onFile,
}: SellListingVideoRecorderDialogProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const tickRef = useRef<number | null>(null)
  const startedAtRef = useRef<number>(0)

  const [phase, setPhase] = useState<Phase>("chooser")
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [starting, setStarting] = useState(false)
  const [reviewUrl, setReviewUrl] = useState<string | null>(null)
  const [reviewFile, setReviewFile] = useState<File | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)

  const minSeconds = listingVideoRecorderMinSeconds()
  const maxSeconds = listingVideoRecorderMaxSeconds()
  const canRecord = listingVideoRecorderSupported()

  const clearTick = useCallback(() => {
    if (tickRef.current != null) {
      window.clearInterval(tickRef.current)
      tickRef.current = null
    }
  }, [])

  const releaseCamera = useCallback(() => {
    clearTick()
    const recorder = recorderRef.current
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.stop()
      } catch {
        /* ignore */
      }
    }
    recorderRef.current = null
    stopListingVideoRecorderStream(streamRef.current)
    streamRef.current = null
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setRecording(false)
  }, [clearTick])

  const reviewUrlRef = useRef<string | null>(null)
  reviewUrlRef.current = reviewUrl

  const revokeReviewUrl = useCallback(() => {
    const url = reviewUrlRef.current
    if (url?.startsWith("blob:")) URL.revokeObjectURL(url)
    reviewUrlRef.current = null
    setReviewUrl(null)
    setReviewFile(null)
  }, [])

  useEffect(() => {
    if (open) return
    releaseCamera()
    revokeReviewUrl()
    setPhase("chooser")
    setElapsed(0)
    setStarting(false)
    setCameraError(null)
    chunksRef.current = []
  }, [open, releaseCamera, revokeReviewUrl])

  useEffect(() => {
    return () => {
      releaseCamera()
      const url = reviewUrlRef.current
      if (url?.startsWith("blob:")) URL.revokeObjectURL(url)
    }
  }, [releaseCamera])

  const deliverFile = useCallback(
    (file: File) => {
      if (onFile) {
        onFile(file)
      } else {
        const input = document.getElementById(fileInputId) as HTMLInputElement | null
        if (!input) {
          toast.error("Couldn't attach that video. Try choosing a file instead.")
          return
        }
        dispatchFileToInput(input, file)
      }
      onOpenChange(false)
    },
    [fileInputId, onFile, onOpenChange],
  )

  const openLibrary = useCallback(() => {
    const input = document.getElementById(fileInputId) as HTMLInputElement | null
    if (!input) {
      toast.error("Couldn't open your library. Refresh and try again.")
      return
    }
    onOpenChange(false)
    // Let the dialog close before the native picker so focus isn't trapped.
    window.setTimeout(() => input.click(), 50)
  }, [fileInputId, onOpenChange])

  const startCamera = useCallback(async () => {
    if (!canRecord) {
      toast.error("HD recording isn’t supported here. Choose a video from your library instead.")
      return
    }
    setStarting(true)
    setCameraError(null)
    setPhase("recording")
    try {
      const stream = await openListingVideoRecorderStream()
      streamRef.current = stream
      const el = videoRef.current
      if (el) {
        el.srcObject = stream
        el.muted = true
        el.playsInline = true
        await el.play().catch(() => undefined)
      }
    } catch {
      setCameraError("Couldn’t access the camera. Check permissions, or choose a video from your library.")
      releaseCamera()
    } finally {
      setStarting(false)
    }
  }, [canRecord, releaseCamera])

  const stopRecordingInternal = useCallback(() => {
    const recorder = recorderRef.current
    if (!recorder || recorder.state === "inactive") return
    try {
      recorder.stop()
    } catch {
      /* ignore */
    }
  }, [])

  const beginRecording = useCallback(() => {
    const stream = streamRef.current
    const mime = pickListingVideoRecorderMime()
    if (!stream || !mime) {
      toast.error("Recording isn’t available. Choose a video from your library instead.")
      return
    }

    chunksRef.current = []
    let recorder: MediaRecorder
    try {
      recorder = new MediaRecorder(stream, {
        mimeType: mime.mimeType,
        videoBitsPerSecond: LISTING_VIDEO_RECORDER_VIDEO_BITS_PER_SECOND,
        audioBitsPerSecond: LISTING_VIDEO_RECORDER_AUDIO_BITS_PER_SECOND,
      })
    } catch {
      toast.error("Couldn't start HD recording. Try choosing a file instead.")
      return
    }

    recorderRef.current = recorder
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data)
    }
    recorder.onstop = () => {
      clearTick()
      setRecording(false)
      const durationSec = (Date.now() - startedAtRef.current) / 1000
      stopListingVideoRecorderStream(streamRef.current)
      streamRef.current = null
      if (videoRef.current) videoRef.current.srcObject = null

      if (durationSec < minSeconds) {
        toast.error(`Videos need to be at least ${minSeconds} seconds. Try again.`)
        setPhase("recording")
        void startCamera()
        return
      }

      const blob = new Blob(chunksRef.current, { type: mime.mimeType.split(";")[0] || "video/webm" })
      chunksRef.current = []
      const file = new File([blob], `listing-video-${Date.now()}.${mime.extension}`, {
        type: blob.type || (mime.extension === "mp4" ? "video/mp4" : "video/webm"),
        lastModified: Date.now(),
      })
      const url = URL.createObjectURL(blob)
      setReviewFile(file)
      setReviewUrl((prev) => {
        if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev)
        return url
      })
      setPhase("review")
    }

    startedAtRef.current = Date.now()
    setElapsed(0)
    setRecording(true)
    recorder.start(250)
    clearTick()
    tickRef.current = window.setInterval(() => {
      const next = (Date.now() - startedAtRef.current) / 1000
      setElapsed(next)
      if (next >= maxSeconds) {
        stopRecordingInternal()
      }
    }, 200)
  }, [clearTick, maxSeconds, minSeconds, startCamera, stopRecordingInternal])

  const useRecording = useCallback(() => {
    if (!reviewFile) return
    deliverFile(reviewFile)
  }, [deliverFile, reviewFile])

  const retake = useCallback(() => {
    revokeReviewUrl()
    setElapsed(0)
    void startCamera()
  }, [revokeReviewUrl, startCamera])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[min(92vh,40rem)] w-[calc(100%-1.5rem)] max-w-md overflow-hidden p-0 sm:rounded-2xl"
        showCloseButton
      >
        {phase === "chooser" ? (
          <>
            <DialogHeader className="space-y-1 px-5 pb-2 pt-6 text-left sm:px-6">
              <DialogTitle>Add a video</DialogTitle>
              <DialogDescription>
                Record in HD here for the best quality, or pick a clip from your library.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2 px-5 pb-6 sm:px-6">
              <Button
                type="button"
                size="lg"
                className="w-full justify-start gap-3"
                onClick={() => void startCamera()}
                disabled={!canRecord}
              >
                <Video className="h-5 w-5" aria-hidden />
                Record HD video
              </Button>
              {!canRecord ? (
                <p className="text-xs text-muted-foreground">
                  HD recording isn’t available in this browser — choose a library clip instead.
                </p>
              ) : null}
              <Button
                type="button"
                size="lg"
                variant="outline"
                className="w-full justify-start gap-3"
                onClick={openLibrary}
              >
                <Film className="h-5 w-5" aria-hidden />
                Choose from library
              </Button>
              <p className="pt-1 text-xs text-muted-foreground">
                Tip: clips from your Camera app are usually sharper than the system “Take Video”
                shortcut.
              </p>
            </div>
          </>
        ) : null}

        {phase === "recording" ? (
          <>
            <DialogHeader className="space-y-1 px-5 pb-2 pt-6 text-left sm:px-6">
              <DialogTitle>{recording ? "Recording…" : "Ready to record"}</DialogTitle>
              <DialogDescription>
                {minSeconds}–{Math.floor(maxSeconds / 60)} minutes · aims for 1080p
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 px-5 pb-6 sm:px-6">
              <div className="relative aspect-video overflow-hidden rounded-xl bg-black">
                {/* Live preview — not next/image; no mirror so rear-camera product shots stay true. */}
                <video
                  ref={videoRef}
                  className="h-full w-full object-cover"
                  muted
                  playsInline
                  autoPlay
                />
                {starting ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white">
                    <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
                  </div>
                ) : null}
                {recording ? (
                  <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/70 px-2.5 py-1 text-xs font-medium text-white">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" aria-hidden />
                    {formatListingVideoRecorderClock(elapsed)}
                    <span className="text-white/70">/ {formatListingVideoRecorderClock(maxSeconds)}</span>
                  </div>
                ) : null}
              </div>
              {cameraError ? (
                <p className="text-sm text-destructive">{cameraError}</p>
              ) : null}
              <DialogFooter className="flex-col gap-2 sm:flex-col">
                {!recording ? (
                  <Button
                    type="button"
                    size="lg"
                    className="w-full"
                    onClick={beginRecording}
                    disabled={starting || Boolean(cameraError)}
                  >
                    Start recording
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="lg"
                    variant="destructive"
                    className="w-full gap-2"
                    onClick={stopRecordingInternal}
                    disabled={elapsed < 1}
                  >
                    <Square className="h-4 w-4 fill-current" aria-hidden />
                    Stop
                    {elapsed < minSeconds ? (
                      <span className="text-xs font-normal opacity-90">
                        ({Math.ceil(minSeconds - elapsed)}s min)
                      </span>
                    ) : null}
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => {
                    releaseCamera()
                    setPhase("chooser")
                  }}
                >
                  Back
                </Button>
              </DialogFooter>
            </div>
          </>
        ) : null}

        {phase === "review" && reviewUrl ? (
          <>
            <DialogHeader className="space-y-1 px-5 pb-2 pt-6 text-left sm:px-6">
              <DialogTitle>Use this video?</DialogTitle>
              <DialogDescription>
                {formatListingVideoRecorderClock(elapsed)} · recorded in HD on this device
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 px-5 pb-6 sm:px-6">
              <div className="overflow-hidden rounded-xl bg-black">
                <video
                  src={reviewUrl}
                  className="aspect-video w-full object-contain"
                  controls
                  playsInline
                  preload="metadata"
                />
              </div>
              <DialogFooter className="flex-col gap-2 sm:flex-col">
                <Button type="button" size="lg" className="w-full" onClick={useRecording}>
                  Use video
                </Button>
                <Button type="button" variant="outline" className="w-full" onClick={retake}>
                  Retake
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => {
                    revokeReviewUrl()
                    setPhase("chooser")
                  }}
                >
                  Back
                </Button>
              </DialogFooter>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
