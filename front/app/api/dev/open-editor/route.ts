import { type NextRequest, NextResponse } from 'next/server';
import path from 'node:path';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const launchEditor = require('react-dev-utils/launchEditor') as (
  fileName: string,
  lineNumber: number,
  colNumber: number
) => void;

// Force VS Code as editor on all platforms
process.env.REACT_EDITOR = 'code';

const ROOT = process.cwd();

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;
  const fileName = searchParams.get('fileName');
  const lineNumber = Number(searchParams.get('lineNumber') ?? 1);
  const colNumber = Number(searchParams.get('colNumber') ?? 1);

  if (!fileName) {
    return NextResponse.json({ error: 'fileName is required' }, { status: 400 });
  }

  const absolutePath = path.isAbsolute(fileName) ? fileName : path.resolve(ROOT, fileName);
  launchEditor(absolutePath, lineNumber, colNumber);
  return NextResponse.json({ ok: true });
}
