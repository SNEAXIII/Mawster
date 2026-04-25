'use client';

import { useI18n } from '@/app/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MasteryEntry, MasteryUpsertItem } from '@/app/services/masteries';

interface MasteryTabProps {
  masteries: MasteryEntry[];
  masteryForm: MasteryUpsertItem[];
  loading: boolean;
  saving: boolean;
  isOwner: boolean;
  onFieldChange: (
    masteryId: string,
    field: 'unlocked' | 'attack' | 'defense',
    value: number,
    masteryMaxValue: number
  ) => void;
  onSave: () => void;
}

function getCardStyle(unlocked: number, maxValue: number) {
  if (unlocked === 0) return '';
  if (unlocked >= maxValue) return 'border-amber-400/70';
  return 'border-blue-500/60';
}

function getTitleStyle(unlocked: number, maxValue: number) {
  if (unlocked >= maxValue && maxValue > 0) return 'text-amber-400';
  if (unlocked > 0) return 'text-blue-400';
  return '';
}

function getInputStyle(value: number, max: number) {
  if (max === 0) return '';
  if (value >= max) return 'bg-green-950/60 text-green-400';
  if (value > 0) return 'text-foreground';
}

export default function MasteryTab({
  masteries,
  masteryForm,
  loading,
  saving,
  isOwner,
  onFieldChange,
  onSave,
}: Readonly<MasteryTabProps>) {
  const { t } = useI18n();

  if (loading) {
    return <p className='text-muted-foreground'>{t.common.loading}</p>;
  }

  if (masteries.length === 0) {
    return <p className='text-muted-foreground'>{t.mastery.noMasteries}</p>;
  }

  const toCyKey = (name: string) => name.toLowerCase().replaceAll(/\s+/g, '-');

  return (
    <div>
      <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4'>
        {masteries.map((mastery) => {
          const formItem = masteryForm.find((f) => f.mastery_id === mastery.mastery_id);
          if (!formItem) return null;
          const isMaxed =
            formItem.unlocked >= mastery.mastery_max_value && mastery.mastery_max_value > 0;
          return (
            <Card
              key={mastery.mastery_id}
              data-cy={`mastery-card-${toCyKey(mastery.mastery_name)}`}
              className={getCardStyle(formItem.unlocked, mastery.mastery_max_value)}
            >
              <CardHeader className='pb-2'>
                <CardTitle
                  className={`text-sm uppercase tracking-wide flex items-center gap-2 ${getTitleStyle(formItem.unlocked, mastery.mastery_max_value)}`}
                >
                  {t.mastery.names[mastery.mastery_order as keyof typeof t.mastery.names] ??
                    mastery.mastery_name}
                  {isMaxed && (
                    <span className='text-[10px] font-bold bg-amber-400/20 text-amber-400 px-1.5 py-0.5 rounded normal-case tracking-normal'>
                      MAX
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className='grid grid-cols-3'>
                  {(['unlocked', 'attack', 'defense'] as const).map((field) => {
                    const displayMax =
                      field === 'unlocked' ? mastery.mastery_max_value : formItem.unlocked;
                    return (
                      <div
                        key={field}
                        className='text-center'
                      >
                        <p className='text-xs text-muted-foreground mb-1'>{t.mastery[field]}</p>
                        <div className='flex items-center justify-center w-fit mx-auto'>
                          <Input
                            type='text'
                            inputMode='numeric'
                            value={formItem[field]}
                            onChange={(e) => {
                              const digits = e.target.value.replace(/\D/g, '');
                              const val = digits === '' ? 0 : parseInt(digits.slice(-1), 10);
                              onFieldChange(
                                mastery.mastery_id,
                                field,
                                val,
                                mastery.mastery_max_value
                              );
                            }}
                            disabled={!isOwner}
                            className={`text-center w-10 font-normal normal-case focus-visible:ring-0 ${getInputStyle(formItem[field], displayMax)}`}
                            data-cy={`mastery-${toCyKey(mastery.mastery_name)}-${field}`}
                          />
                          <span className='text-muted-foreground font-normal normal-case ml-1'>
                            / {displayMax}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {isOwner && (
        <Button
          onClick={onSave}
          disabled={saving}
          data-cy='mastery-save-button'
        >
          {saving ? t.common.loading : t.mastery.save}
        </Button>
      )}
    </div>
  );
}
