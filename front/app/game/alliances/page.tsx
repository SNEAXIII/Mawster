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
  getEligibleOwners,
  getEligibleMembers,
  getEligibleOfficers,
  createAlliance,
  deleteAlliance,
  addOfficer,
  removeOfficer,
  addMember,
  removeMember,
  setMemberGroup,
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
import { Loader, Plus, Trash2, Shield, Crown, UserPlus, Users, X } from 'lucide-react';

const GROUP_COLORS: Record<number, string> = {
  1: 'bg-green-100 text-green-800',
  2: 'bg-orange-100 text-orange-800',
  3: 'bg-red-100 text-red-800',
};

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
  const [eligibleOwners, setEligibleOwners] = useState<GameAccount[]>([]);
  const [eligibleMembers, setEligibleMembers] = useState<GameAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // Create form
  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const [ownerId, setOwnerId] = useState('');

  // Officer management
  const [officerAllianceId, setOfficerAllianceId] = useState<string | null>(null);
  const [officerAccountId, setOfficerAccountId] = useState('');
  const [eligibleOfficers, setEligibleOfficers] = useState<GameAccount[]>([]);

  // Member management
  const [memberAllianceId, setMemberAllianceId] = useState<string | null>(null);
  const [memberAccountId, setMemberAccountId] = useState('');

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

  const fetchEligibleOwners = async () => {
    try {
      const data = await getEligibleOwners();
      setEligibleOwners(data);
      if (data.length > 0 && !ownerId) {
        setOwnerId(data[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchEligibleMembers = async () => {
    try {
      const data = await getEligibleMembers();
      setEligibleMembers(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (status === 'authenticated') {
      fetchAlliances();
      fetchEligibleOwners();
      fetchEligibleMembers();
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
      setOwnerId('');
      await Promise.all([fetchAlliances(), fetchEligibleOwners(), fetchEligibleMembers()]);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || t.game.alliances.createError);
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
      await Promise.all([fetchAlliances(), fetchEligibleOwners(), fetchEligibleMembers()]);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || t.game.alliances.deleteError);
    }
  };

  // ---- Officers ----
  const handleOpenAddOfficer = async (allianceId: string) => {
    setOfficerAllianceId(allianceId);
    setOfficerAccountId('');
    try {
      const data = await getEligibleOfficers(allianceId);
      setEligibleOfficers(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddOfficer = async (allianceId: string) => {
    if (!officerAccountId) return;
    try {
      await addOfficer(allianceId, officerAccountId);
      toast.success(t.game.alliances.adjointAddSuccess);
      setOfficerAllianceId(null);
      setOfficerAccountId('');
      await fetchAlliances();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || t.game.alliances.adjointAddError);
    }
  };

  const handleRemoveOfficer = async (allianceId: string, gameAccountId: string) => {
    try {
      await removeOfficer(allianceId, gameAccountId);
      toast.success(t.game.alliances.adjointRemoveSuccess);
      await fetchAlliances();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || t.game.alliances.adjointRemoveError);
    }
  };

  // ---- Members ----
  const handleOpenAddMember = async (allianceId: string) => {
    setMemberAllianceId(allianceId);
    setMemberAccountId('');
    await fetchEligibleMembers();
  };

  const handleAddMember = async (allianceId: string) => {
    if (!memberAccountId) return;
    try {
      await addMember(allianceId, memberAccountId);
      toast.success(t.game.alliances.memberAddSuccess);
      setMemberAllianceId(null);
      setMemberAccountId('');
      await Promise.all([fetchAlliances(), fetchEligibleMembers()]);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || t.game.alliances.memberAddError);
    }
  };

  const handleRemoveMember = async (allianceId: string, gameAccountId: string) => {
    try {
      await removeMember(allianceId, gameAccountId);
      toast.success(t.game.alliances.memberRemoveSuccess);
      await Promise.all([fetchAlliances(), fetchEligibleMembers()]);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || t.game.alliances.memberRemoveError);
    }
  };

  // ---- Groups ----
  const handleSetGroup = async (allianceId: string, gameAccountId: string, group: number | null) => {
    try {
      await setMemberGroup(allianceId, gameAccountId, group);
      toast.success(t.game.alliances.groupSetSuccess);
      await fetchAlliances();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || t.game.alliances.groupSetError);
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
    <div className="max-w-4xl mx-auto p-6 space-y-6">
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
          {eligibleOwners.length === 0 ? (
            <p className="text-sm text-gray-500">{t.game.alliances.noEligibleAccount}</p>
          ) : (
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">{t.game.alliances.name}</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)}
                    placeholder={t.game.alliances.namePlaceholder} maxLength={100} required disabled={creating} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tag">{t.game.alliances.tag}</Label>
                  <Input id="tag" value={tag} onChange={(e) => setTag(e.target.value.toUpperCase())}
                    placeholder={t.game.alliances.tagPlaceholder} maxLength={10} required disabled={creating} />
                </div>
                <div className="space-y-2">
                  <Label>{t.game.alliances.owner}</Label>
                  <Select value={ownerId} onValueChange={setOwnerId} disabled={creating}>
                    <SelectTrigger><SelectValue placeholder={t.game.alliances.selectOwner} /></SelectTrigger>
                    <SelectContent>
                      {eligibleOwners.map((acc) => (
                        <SelectItem key={acc.id} value={acc.id}>{acc.game_pseudo}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button type="submit" disabled={creating || !name.trim() || !tag.trim() || !ownerId}>
                {creating ? (<><Loader className="w-4 h-4 mr-2 animate-spin" />{t.game.alliances.creating}</>) : t.game.alliances.createButton}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Alliance list */}
      {alliances.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            <Shield className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p>{t.game.alliances.empty}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {alliances.map((alliance) => (
            <Card key={alliance.id}>
              <CardContent className="py-4 space-y-4">
                {/* Alliance header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Shield className="h-5 w-5 text-purple-500" />
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900">{alliance.name}</p>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800">[{alliance.tag}]</span>
                        <span className="text-xs text-gray-400">{alliance.member_count} {t.game.alliances.members}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Crown className="h-3 w-3 text-yellow-500" />
                        <span className="text-xs text-gray-600">{alliance.owner_pseudo}</span>
                        <span className="text-xs text-gray-400">·</span>
                        <span className="text-xs text-gray-400">{formatDate(alliance.created_at)}</span>
                      </div>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    onClick={() => setDeleteTarget(alliance.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>

                {/* Members section */}
                <div className="border-t pt-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="h-4 w-4 text-green-500" />
                    <span className="text-sm font-medium text-gray-700">
                      {t.game.alliances.membersTitle} ({alliance.member_count})
                    </span>
                  </div>

                  {alliance.members.length > 0 && (
                    <div className="space-y-1 mb-2">
                      {alliance.members.map((member) => (
                        <div key={member.id} className="flex items-center justify-between py-1 px-2 rounded hover:bg-gray-50">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-800">{member.game_pseudo}</span>
                            {member.is_owner && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-800">
                                <Crown className="h-2.5 w-2.5" /> Owner
                              </span>
                            )}
                            {member.is_officer && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700">
                                Officer
                              </span>
                            )}
                            {member.alliance_group ? (
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs ${GROUP_COLORS[member.alliance_group]}`}>
                                {t.game.alliances.group} {member.alliance_group}
                              </span>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-1">
                            {/* Group selector */}
                            <Select
                              value={member.alliance_group?.toString() ?? 'none'}
                              onValueChange={(val) => handleSetGroup(alliance.id, member.id, val === 'none' ? null : parseInt(val))}
                            >
                              <SelectTrigger className="h-7 w-24 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">{t.game.alliances.noGroup}</SelectItem>
                                <SelectItem value="1">{t.game.alliances.group} 1</SelectItem>
                                <SelectItem value="2">{t.game.alliances.group} 2</SelectItem>
                                <SelectItem value="3">{t.game.alliances.group} 3</SelectItem>
                              </SelectContent>
                            </Select>
                            {!member.is_owner && (
                              <button onClick={() => handleRemoveMember(alliance.id, member.id)}
                                className="text-red-400 hover:text-red-600 p-1" aria-label={`Remove ${member.game_pseudo}`}>
                                <X className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add member inline */}
                  {memberAllianceId === alliance.id ? (
                    <div className="flex items-center gap-2 mt-2">
                      <Select value={memberAccountId} onValueChange={setMemberAccountId}>
                        <SelectTrigger className="w-48"><SelectValue placeholder={t.game.alliances.selectMember} /></SelectTrigger>
                        <SelectContent>
                          {eligibleMembers.map((acc) => (
                            <SelectItem key={acc.id} value={acc.id}>{acc.game_pseudo}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button size="sm" disabled={!memberAccountId} onClick={() => handleAddMember(alliance.id)}>{t.game.alliances.addMemberButton}</Button>
                      <Button size="sm" variant="ghost" onClick={() => { setMemberAllianceId(null); setMemberAccountId(''); }}>{t.common.cancel}</Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => handleOpenAddMember(alliance.id)}>
                      <UserPlus className="h-3 w-3 mr-1" />{t.game.alliances.addMember}
                    </Button>
                  )}
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
                        <span key={adj.id} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-blue-50 text-blue-700">
                          {adj.game_pseudo}
                          <button onClick={() => handleRemoveOfficer(alliance.id, adj.game_account_id)}
                            className="ml-1 hover:text-red-500 cursor-pointer"
                            aria-label={`${t.game.alliances.removeOfficer} ${adj.game_pseudo}`}>
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  {officerAllianceId === alliance.id ? (
                    <div className="flex items-center gap-2">
                      <Select value={officerAccountId} onValueChange={setOfficerAccountId}>
                        <SelectTrigger className="w-48"><SelectValue placeholder={t.game.alliances.selectOfficer} /></SelectTrigger>
                        <SelectContent>
                          {eligibleOfficers.map((acc) => (
                            <SelectItem key={acc.id} value={acc.id}>{acc.game_pseudo}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button size="sm" disabled={!officerAccountId} onClick={() => handleAddOfficer(alliance.id)}>{t.game.alliances.addOfficerButton}</Button>
                      <Button size="sm" variant="ghost" onClick={() => { setOfficerAllianceId(null); setOfficerAccountId(''); }}>{t.common.cancel}</Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => handleOpenAddOfficer(alliance.id)}>
                      <UserPlus className="h-3 w-3 mr-1" />{t.game.alliances.addOfficer}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

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
