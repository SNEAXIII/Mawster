'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { getMyModeration } from '@/app/services/moderation';

export type MyMute = { reason: string; expires_at: string | null } | null;

const MyModerationContext = createContext<{ mute: MyMute }>({ mute: null });

export function useMyModeration() {
  return useContext(MyModerationContext);
}

export default function MyModerationProvider({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [mute, setMute] = useState<MyMute>(null);
  const pathname = usePathname();

  // Refetch on every navigation: the provider lives in a persistent layout, so a
  // mount-only effect would freeze the mute state until a full page reload.
  useEffect(() => {
    getMyModeration()
      .then((d) => setMute(d.mute))
      .catch(() => setMute(null));
  }, [pathname]);

  return (
    <MyModerationContext.Provider value={{ mute }}>{children}</MyModerationContext.Provider>
  );
}
