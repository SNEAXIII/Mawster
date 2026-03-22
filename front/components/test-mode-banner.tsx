import { getServerApiUrl } from '@/app/lib/serverApiUrl';

interface EnvInfo {
  mode: string;
  api_port: number;
  db_host: string;
  db_port: number;
  db_name: string;
  db_user: string;
}

export default async function TestModeBanner() {
  if (process.env['API_PORT'] !== '8001') return null;

  let envInfo: EnvInfo | null = null;
  try {
    const res = await fetch(`${getServerApiUrl()}/dev/env-info`, { cache: 'no-store' });
    if (res.ok) envInfo = await res.json();
  } catch {
    // backend not ready — show partial info
  }

  const frontPort = process.env['PORT'] ?? '3001';
  const nextauthUrl = process.env['NEXTAUTH_URL'] ?? 'http://localhost:3001';

  return (
    <div className='fixed bottom-0 left-0 right-0 z-50 flex flex-wrap gap-x-4 gap-y-0.5 bg-yellow-400/95 px-3 py-1 font-mono text-xs text-black'>
      <span className='font-bold'>🧪 TEST</span>
      <span>front :{frontPort}</span>
      <span>api :{envInfo?.api_port ?? process.env['API_PORT']}</span>
      <span>nextauth :{nextauthUrl}</span>
      {envInfo && (
        <>
          <span>db :{envInfo.db_name}</span>
          <span>db-port :{envInfo.db_port}</span>
          <span>db-user :{envInfo.db_user}</span>
        </>
      )}
    </div>
  );
}
