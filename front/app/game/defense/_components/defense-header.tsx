'use client';

import { useI18n } from '@/app/i18n';
import { type Alliance } from '@/app/services/game';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { type DefenseSummary } from '@/app/services/defense';
import { Trash2, Download, Upload } from 'lucide-react';

interface DefenseHeaderProps {
  alliances: Alliance[];
  selectedAllianceId: string;
  onAllianceChange: (id: string) => void;
  selectedBg: number;
  onBgChange: (bg: number) => void;
  onExport: () => void;
  onImportClick: () => void;
  onClearClick: () => void;
  canManage: boolean;
  defenseSummary: DefenseSummary | null;
}

export default function DefenseHeader({
  alliances,
  selectedAllianceId,
  onAllianceChange,
  selectedBg,
  onBgChange,
  onExport,
  onImportClick,
  onClearClick,
  canManage,
  defenseSummary,
}: Readonly<DefenseHeaderProps>) {
  const { t } = useI18n();

  return (
    <Card>
      <CardContent className='p-4'>
        <div className='flex flex-col sm:flex-row gap-3 items-start sm:items-center'>
          {/* Alliance selector */}
          {alliances.length > 1 && (
            <div className='flex items-center gap-2'>
              <label className='text-sm font-medium whitespace-nowrap'>
                {t.game.defense.alliance}:
              </label>
              <Select
                value={selectedAllianceId}
                onValueChange={onAllianceChange}
              >
                <SelectTrigger
                  className='w-[200px]'
                  data-cy='defense-alliance-select'
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {alliances.map((a) => (
                    <SelectItem
                      key={a.id}
                      value={a.id}
                    >
                      [{a.tag}] {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* BG selector */}
          <div className='flex flex-wrap items-center gap-2'>
            <label className='text-sm font-medium whitespace-nowrap'>
              {t.game.defense.battlegroup}:
            </label>
            <div className='flex gap-1'>
              {[1, 2, 3].map((bg) => (
                <Button
                  key={bg}
                  variant={selectedBg === bg ? 'default' : 'outline'}
                  size='sm'
                  onClick={() => onBgChange(bg)}
                  data-cy={`defense-bg-${bg}`}
                >
                  BG {bg}
                </Button>
              ))}
            </div>
          </div>

          {/* Export / Import — managers only */}
          {canManage && (
            <div className='flex gap-1 ml-auto'>
              {/* Clear button */}
              {defenseSummary && defenseSummary.placements.length > 0 && (
                <Button
                  variant='destructive'
                  size='sm'
                  className='ml-auto'
                  data-cy='defense-clear-all'
                  onClick={onClearClick}
                >
                  <Trash2 className='w-4 h-4 mr-1' />
                  {t.game.defense.clearAll}
                </Button>
              )}
              <Button
                variant='outline'
                size='sm'
                onClick={onExport}
                data-cy='defense-export'
              >
                <Download className='w-4 h-4 mr-1' />
                {t.game.defense.importExport.exportBtn}
              </Button>
              <Button
                variant='outline'
                size='sm'
                onClick={onImportClick}
                data-cy='defense-import'
              >
                <Upload className='w-4 h-4 mr-1' />
                {t.game.defense.importExport.importBtn}
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
