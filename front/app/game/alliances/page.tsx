'use client';

import { useSession } from 'next-auth/react';
import { redirect, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useI18n } from '@/app/i18n';
import { toast } from 'sonner';
import {
  type Alliance,
  type GameAccount,
  getAllAlliances,
  getMyGameAccounts,
  createAlliance,
  deleteAlliance,
  addOfficer,
  removeOfficer,
} from '@/app/services/game';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ConfirmationDialog } from '@/components/confirmation-dialog';
import { Loader, Plus, Trash2, Shield, Crown, UserPlus, X } from 'lucide-react';

export default function AlliancesPage() {
  const pathname = usePathname();
  const { locale, t } = useI18n();
  const { status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect(`/login?callbackUrl=${pathname}`);
    },
  });

  const [alliances, setAlliances] = useState<Alliance[]>([]);
  const [gameAccounts, setGameAccounts] = useState<GameAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const [ownerId, setOwnerId] = useState('');

  // Officer management
  const [adjointAllianceId, setOfficerAllianceId] = useState<string | null>(null);
  const [adjointAccountId, setOfficerAccountId] = useState('');

  const fetchAlliances = async () => {
    try {
      const data = await getAllAlliances();
      setAlliances(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchGameAccounts = async () => {
    try {
      const data = await getMyGameAccounts();
      setGameAccounts(data);
      if (data.length > 0 && !ownerId) {
        setOwnerId(data[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (status === 'authenticated') {
      fetchAlliances();
      fetchGameAccounts();
    }
  }, [status]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !tag.trim() || !ownerId) return;

    setCreating(true);
    try {
      await createAlliance(name.trim(), tag.trim(), ownerId);
      toast.success(t.game.alliances.createSuccess);
      setName('');
      setTag('');
      await fetchAlliances();
    } catch (err) {
      console.error(err);
      toast.error(t.game.alliances.createError);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteAlliance(deleteTarget);
      toast.success(t.game.alliances.deleteSuccess);
      setDeleteTarget(null);
      await fetchAlliances();
    } catch (err) {
      console.error(err);
      toast.error(t.game.alliances.deleteError);
    }
  };

  const handleAddOfficer = async (allianceId: string) => {
    if (!adjointAccountId) return;
    try {
      await addOfficer(allianceId, adjointAccountId);
      toast.success(t.game.alliances.adjointAddSuccess);
      setOfficerAllianceId(null);
      setOfficerAccountId('');
      await fetchAlliances();
    } catch (err) {
      console.error(err);
      toast.error(t.game.alliances.adjointAddError);
    }
  };

  const handleRemoveOfficer = async (allianceId: string, gameAccountId: string) => {
    try {
      await removeOfficer(allianceId, gameAccountId);
      toast.success(t.game.alliances.adjointRemoveSuccess);
      await fetchAlliances();
    } catch (err) {
      console.error(err);
      toast.error(t.game.alliances.adjointRemoveError);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-US', {
        dateStyle: 'medium',
      }).format(new Date(dateString));
    } catch {
      return dateString;
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t.game.alliances.title}</h1>
        <p className="text-gray-500 mt-1">{t.game.alliances.description}</p>
      </div>

      {/* Create form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Plus className="h-5 w-5" />
            {t.game.alliances.createTitle}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {gameAccounts.length === 0 ? (
            <p className="text-sm text-gray-500">{t.game.alliances.noGameAccount}</p>
          ) : (
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">{t.game.alliances.name}</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t.game.alliances.namePlaceholder}
                    maxLength={100}
                    required
                    disabled={creating}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tag">{t.game.alliances.tag}</Label>
                  <Input
                    id="tag"
                    value={tag}
                    onChange={(e) => setTag(e.target.value.toUpperCase())}
                    placeholder={t.game.alliances.tagPlaceholder}
                    maxLength={10}
                    required
                    disabled={creating}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t.game.alliances.owner}</Label>
                  <Select value={ownerId} onValueChange={setOwnerId} disabled={creating}>
                    <SelectTrigger>
                      <SelectValue placeholder={t.game.alliances.selectOwner} />
                    </SelectTrigger>
                    <SelectContent>
                      {gameAccounts.map((acc) => (
                        <SelectItem key={acc.id} value={acc.id}>
                          {acc.game_pseudo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button type="submit" disabled={creating || !name.trim() || !tag.trim() || !ownerId}>
                {creating ? (
                  <>
                    <Loader className="w-4 h-4 mr-2 animate-spin" />
                    {t.game.alliances.creating}
                  </>
                ) : (
                  t.game.alliances.createButton
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Alliances list */}
      {alliances.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            <Shield className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p>{t.game.alliances.empty}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {alliances.map((alliance) => (
            <Card key={alliance.id}>
              <CardContent className="py-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Shield className="h-5 w-5 text-purple-500" />
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900">{alliance.name}</p>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800">
                          [{alliance.tag}]
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Crown className="h-3 w-3 text-yellow-500" />
                        <span className="text-xs text-gray-600">{alliance.owner_pseudo}</span>
                        <span className="text-xs text-gray-400">·</span>
                        <span className="text-xs text-gray-400">{formatDate(alliance.created_at)}</span>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    onClick={() => setDeleteTarget(alliance.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                {/* Officers section */}
                <div className="border-t pt-3">
                  <div className="flex items-center gap-2 mb-2">
                    <UserPlus className="h-4 w-4 text-blue-500" />
                    <span className="text-sm font-medium text-gray-700">
                      {t.game.alliances.officers} ({alliance.officers.length})
                    </span>
                  </div>

                  {alliance.officers.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {alliance.officers.map((adj) => (
                        <span
                          key={adj.id}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-blue-50 text-blue-700"
                        >
                          {adj.game_pseudo}
                          <button
                            onClick={() => handleRemoveOfficer(alliance.id, adj.game_account_id)}
                            className="ml-1 hover:text-red-500 cursor-pointer"
                            aria-label={`${t.game.alliances.removeOfficer} ${adj.game_pseudo}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Add adjoint inline */}
                  {adjointAllianceId === alliance.id ? (
                    <div className="flex items-center gap-2">
                      <Select value={adjointAccountId} onValueChange={setOfficerAccountId}>
                        <SelectTrigger className="w-48">
                          <SelectValue placeholder={t.game.alliances.selectOfficer} />
                        </SelectTrigger>
                        <SelectContent>
                          {gameAccounts
                            .filter(
                              (acc) =>
                                acc.id !== alliance.owner_id &&
                                !alliance.officers.some((a) => a.game_account_id === acc.id),
                            )
                            .map((acc) => (
                              <SelectItem key={acc.id} value={acc.id}>
                                {acc.game_pseudo}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        disabled={!adjointAccountId}
                        onClick={() => handleAddOfficer(alliance.id)}
                      >
                        {t.game.alliances.addOfficerButton}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => { setOfficerAllianceId(null); setOfficerAccountId(''); }}
                      >
                        {t.common.cancel}
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setOfficerAllianceId(alliance.id)}
                    >
                      <UserPlus className="h-3 w-3 mr-1" />
                      {t.game.alliances.addOfficer}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete confirmation dialog */}
      <ConfirmationDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title={t.common.confirm}
        description={t.game.alliances.deleteConfirm}
        onConfirm={handleDelete}
        variant="destructive"
        confirmText={t.common.delete}
      />
    </div>
  );
}
