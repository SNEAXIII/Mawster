'use client';

import { useSession } from 'next-auth/react';
import { redirect, usePathname } from 'next/navigation';

/**
 * Hook wrapping useSession with automatic redirect to login for
 * unauthenticated users.  Every authenticated page was repeating
 * the exact same pattern — this eliminates the duplication.
 */
export function useRequiredSession() {
  const pathname = usePathname();
  const session = useSession({
    required: true,
    onUnauthenticated() {
      redirect(`/login?callbackUrl=${pathname}`);
    },
  });
  return session;
}
