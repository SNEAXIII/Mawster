'use client';

import React from 'react';
import { useI18n } from '@/app/i18n';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader } from 'lucide-react';
import { type GameAccount } from '@/app/services/game';

interface CreateAllianceFormProps {
  hasAnyAccounts: boolean;
  eligibleOwners: GameAccount[];
  name: string;
  tag: string;
  ownerId: string;
  creating: boolean;
  onNameChange: (value: string) => void;
  onTagChange: (value: string) => void;
  onOwnerChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export default function CreateAllianceForm({
  hasAnyAccounts,
  eligibleOwners,
  name,
  tag,
  ownerId,
  creating,
  onNameChange,
  onTagChange,
  onOwnerChange,
  onSubmit,
}: CreateAllianceFormProps) {
  const { t } = useI18n();

  return (
    <Card>
      <CardContent className='pt-6'>
        <form
          onSubmit={onSubmit}
          className='space-y-4'
        >
          <div className='grid grid-cols-1 sm:grid-cols-3 gap-4'>
            <div className='space-y-2'>
              <Label htmlFor='name'>{t.game.alliances.name}</Label>
              <Input
                id='name'
                data-cy='alliance-name-input'
                value={name}
                onChange={(e) => onNameChange(e.target.value)}
                placeholder={t.game.alliances.namePlaceholder}
                maxLength={50}
                minLength={3}
                required
                disabled={creating}
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='tag'>{t.game.alliances.tag}</Label>
              <Input
                id='tag'
                data-cy='alliance-tag-input'
                value={tag}
                onChange={(e) => onTagChange(e.target.value.toUpperCase())}
                placeholder={t.game.alliances.tagPlaceholder}
                maxLength={5}
                required
                disabled={creating}
              />
            </div>
            <div className='space-y-2'>
              <Label>{t.game.alliances.owner}</Label>
              <Select
                value={ownerId}
                onValueChange={onOwnerChange}
                disabled={creating}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t.game.alliances.selectOwner} />
                </SelectTrigger>
                <SelectContent>
                  {eligibleOwners.map((acc) => (
                    <SelectItem
                      key={acc.id}
                      value={acc.id}
                    >
                      {acc.game_pseudo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button
            type='submit'
            data-cy='alliance-create-btn'
            disabled={creating || !name.trim() || !tag.trim() || !ownerId}
          >
            {creating ? (
              <>
                <Loader className='w-4 h-4 mr-2 animate-spin' />
                {t.game.alliances.creating}
              </>
            ) : (
              t.game.alliances.createButton
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
