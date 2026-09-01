import { notFound } from 'next/navigation'
import { isServerDev } from '@/app/lib/dev-mode'

// Read DEV_MODE at request time instead of baking a 404 into the build.
export const dynamic = 'force-dynamic'

/** Dev-only sandbox pages — 404 in production, like the /api/dev routes. */
export default function DevLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  if (!isServerDev()) notFound()
  return children
}
