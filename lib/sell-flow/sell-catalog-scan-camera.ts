/**
 * Rear-camera still capture for the admin `/sell/scan` matcher.
 */

export function sellCatalogScanCameraSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia)
  )
}

export async function openSellCatalogScanCamera(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Camera isn’t supported in this browser.")
  }

  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
    })
  } catch {
    return navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: "environment" } },
    })
  }
}

export function stopSellCatalogScanCamera(stream: MediaStream | null): void {
  if (!stream) return
  for (const track of stream.getTracks()) {
    try {
      track.stop()
    } catch {
      /* already ended */
    }
  }
}

export function captureFrameFromVideo(video: HTMLVideoElement): Promise<Blob> {
  const width = video.videoWidth
  const height = video.videoHeight
  if (!width || !height) {
    return Promise.reject(new Error("Camera is still starting. Try again in a moment."))
  }

  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) {
    return Promise.reject(new Error("Could not capture this photo."))
  }
  ctx.drawImage(video, 0, 0, width, height)

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Could not capture this photo."))
          return
        }
        resolve(blob)
      },
      "image/jpeg",
      0.86,
    )
  })
}
