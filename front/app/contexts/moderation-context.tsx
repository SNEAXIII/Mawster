'use client';

import { createContext, useContext, useEffect, useState } from 'react';
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

  useEffect(() => {
    getMyModeration()
      .then((d) => setMute(d.mute))
      .catch(() => setMute(null));
  }, []);

  return (
    <MyModerationContext.Provider value={{ mute }}>{children}</MyModerationContext.Provider>
  );
}
