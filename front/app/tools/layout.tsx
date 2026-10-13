import type { Metadata } from 'next'

// Without its own canonical, /tools inherits the root '/' one and Google folds it into the home page.
export const metadata: Metadata = {
  title: 'MCOC tier list maker',
  description:
    'Build and share your own Marvel Contest of Champions tier list — no account needed, sign in to save it.',
  alternates: { canonical: '/tools' },
}

export default function ToolsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children
}
