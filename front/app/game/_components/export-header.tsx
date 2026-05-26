'use client';

interface ExportHeaderProps {
  allianceTag: string;
  allianceName: string;
  modeLabel: string;
  bg: number;
  opponentName?: string;
}

export default function ExportHeader({
  allianceTag,
  allianceName,
  modeLabel,
  bg,
  opponentName,
}: Readonly<ExportHeaderProps>) {
  return (
    <div className='flex items-center justify-between gap-6 px-1 text-xs text-white mb-1'>
      <span className='font-semibold'>
        [{allianceTag}] {allianceName}
        {opponentName && <span className='font-normal'> vs {opponentName}</span>}
      </span>
      <span className='font-medium uppercase tracking-wide'>{modeLabel}</span>
      <span className='font-medium'>BG {bg}</span>
      <span>{new Date().toLocaleDateString()}</span>
    </div>
  );
}
