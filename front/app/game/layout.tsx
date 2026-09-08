import type { Metadata } from 'next'

// Authenticated shells: no crawlable content, so keep them out of the index.
export const metadata: Metadata = {
  title: 'War room',
  robots: { index: false, follow: false },
}

export default function GameLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children
}
