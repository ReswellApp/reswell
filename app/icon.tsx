import { ImageResponse } from 'next/og'

/** Tab / PWA icon: water wave (matches Reswell’s surf theme). */
export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#ffffff',
          fontSize: 22,
          lineHeight: 1,
        }}
      >
        🌊
      </div>
    ),
    { ...size },
  )
}
