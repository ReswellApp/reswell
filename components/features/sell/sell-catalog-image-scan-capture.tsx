"use client"

import { useCallback, useEffect, useId, useRef, useState } from "react"
import { Camera, ImagePlus, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { prepareSellCatalogScanImage } from "@/lib/client/prepare-sell-catalog-scan-image"
import {
  captureFrameFromVideo,
  openSellCatalogScanCamera,
  sellCatalogScanCameraSupported,
  stopSellCatalogScanCamera,
} from "@/lib/sell-flow/sell-catalog-scan-camera"
import { cn } from "@/lib/utils"

type SellCatalogImageScanCaptureProps = {
  previewUrl: string | null
  preparing: boolean
  onPhoto: (file: File) => void
  onError: (message: string) => void
  onClear: () => void
}

export function SellCatalogImageScanCapture({
  previewUrl,
  preparing,
  onPhoto,
  onError,
  onClear,
}: SellCatalogImageScanCaptureProps) {
  const fileInputId = useId()
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [cameraOn, setCameraOn] = useState(false)
  const [startingCamera, setStartingCamera] = useState(false)
  const canUseCamera = sellCatalogScanCameraSupported()

  const releaseCamera = useCallback(() => {
    stopSellCatalogScanCamera(streamRef.current)
    streamRef.current = null
    setCameraOn(false)
  }, [])

  useEffect(() => () => releaseCamera(), [releaseCamera])

  const handleFile = useCallback(
    async (file: File | null) => {
      if (!file) return
      try {
        onPhoto(await prepareSellCatalogScanImage(file))
      } catch (err) {
        onError(err instanceof Error ? err.message : "Could not read that photo.")
      }
    },
    [onError, onPhoto],
  )

  const startCamera = useCallback(async () => {
    if (!canUseCamera) {
      onError("Camera isn’t available here. Upload a photo instead.")
      return
    }
    setStartingCamera(true)
    try {
      const stream = await openSellCatalogScanCamera()
      streamRef.current = stream
      const video = videoRef.current
      if (video) {
        video.srcObject = stream
        await video.play()
      }
      setCameraOn(true)
    } catch {
      onError("Could not open the camera. Check permissions, or upload a photo.")
    } finally {
      setStartingCamera(false)
    }
  }, [canUseCamera, onError])

  const takePhoto = useCallback(async () => {
    const video = videoRef.current
    if (!video) return
    try {
      const blob = await captureFrameFromVideo(video)
      const file = new File([blob], "scan.jpg", { type: "image/jpeg" })
      releaseCamera()
      onPhoto(await prepareSellCatalogScanImage(file))
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not take that photo.")
    }
  }, [onError, onPhoto, releaseCamera])

  return (
    <div className="space-y-3">
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl border border-border bg-muted/30",
          "aspect-[4/3] w-full",
        )}
      >
        {previewUrl ? (
          // Preview of a local capture — not a marketplace asset.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="Photo to scan" className="h-full w-full object-cover" />
        ) : (
          <video
            ref={videoRef}
            className={cn("h-full w-full object-cover", !cameraOn && "hidden")}
            playsInline
            muted
            autoPlay
          />
        )}
        {!previewUrl && !cameraOn ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
            <Camera className="h-8 w-8 text-muted-foreground" aria-hidden />
            <p className="text-sm text-muted-foreground">
              Take a photo of the board or fins — logo and model name in frame if you can.
            </p>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {previewUrl ? (
          <Button type="button" variant="outline" onClick={onClear} disabled={preparing}>
            Retake
          </Button>
        ) : cameraOn ? (
          <>
            <Button type="button" onClick={() => void takePhoto()} disabled={preparing}>
              {preparing ? <Loader2 className="animate-spin" aria-hidden /> : <Camera aria-hidden />}
              Capture
            </Button>
            <Button type="button" variant="outline" onClick={releaseCamera}>
              Cancel camera
            </Button>
          </>
        ) : (
          <>
            <Button
              type="button"
              onClick={() => void startCamera()}
              disabled={startingCamera || !canUseCamera}
            >
              {startingCamera ? <Loader2 className="animate-spin" aria-hidden /> : <Camera aria-hidden />}
              Open camera
            </Button>
            <Button type="button" variant="outline" asChild>
              <label htmlFor={fileInputId} className="cursor-pointer">
                <ImagePlus aria-hidden />
                Upload photo
              </label>
            </Button>
          </>
        )}
      </div>

      <input
        id={fileInputId}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null
          event.target.value = ""
          void handleFile(file)
        }}
      />
    </div>
  )
}
