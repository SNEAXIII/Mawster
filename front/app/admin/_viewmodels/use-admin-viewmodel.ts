'use client';

import { useEffect, useRef, useState } from 'react';
import { redirect, usePathname, useSearchParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

export enum AdminTab {
  Users = 'users',
  Champions = 'champions',
}

interface UseAdminViewModelOptions {
  defaultTab?: AdminTab;
}

export function useAdminViewModel({ defaultTab = AdminTab.Users }: UseAdminViewModelOptions = {}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect(`/login?callbackUrl=${pathname}`);
    },
  });

  const initialTab = (searchParams.get('tab') as AdminTab) || defaultTab;
  const [activeTab, setActiveTab] = useState<AdminTab>(
    Object.values(AdminTab).includes(initialTab) ? initialTab : defaultTab
  );

  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', activeTab);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  return {
    session,
    status,
    activeTab,
    setActiveTab,
  };
}
