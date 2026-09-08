import { ImageResponse } from 'next/og'

export const alt = 'Mawster — Alliance War planner for Marvel Contest of Champions'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// No custom font is loaded: fetching one would make `next build` depend on the network.
export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '0 96px',
          backgroundColor: '#09090b',
          backgroundImage: 'linear-gradient(135deg, #09090b 0%, #17171b 100%)',
        }}
      >
        <div
          style={{
            width: 96,
            height: 8,
            borderRadius: 4,
            backgroundColor: '#fafafa',
            marginBottom: 48,
          }}
        />
        <div style={{ fontSize: 128, fontWeight: 700, color: '#fafafa', letterSpacing: -4 }}>
          Mawster
        </div>
        <div style={{ fontSize: 44, color: '#fafafa', marginTop: 24 }}>
          Alliance War planner for Marvel Contest of Champions
        </div>
        <div style={{ fontSize: 34, color: '#a1a1aa', marginTop: 28 }}>
          Win your wars with a real plan.
        </div>
      </div>
    ),
    size
  )
}
