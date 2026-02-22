'use client';

import { useSession } from 'next-auth/react';
import { redirect, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useI18n } from '@/app/i18n';
import { toast } from 'sonner';
import {
  type Alliance,
  type GameAccount,
  getMyAlliances,
  getMyGameAccounts,
  getEligibleOwners,
  getEligibleMembers,
  createAlliance,
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ConfirmationDialog } from '@/components/confirmation-dialog';
import {
  Loader, Plus, Shield, Crown, UserPlus, Users, UserMinus,
  ChevronDown, ChevronUp, ShieldCheck, ShieldMinus,
} from 'lucide-react';

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
  const [myAccounts, setMyAccounts] = useState<GameAccount[]>([]);
  const [eligibleOwners, setEligibleOwners] = useState<GameAccount[]>([]);
  const [eligibleMembers, setEligibleMembers] = useState<GameAccount[]>([]);
  const [hasAnyAccounts, setHasAnyAccounts] = useState(true);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  // Create form
  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const [ownerId, setOwnerId] = useState('');

  // Member management
  const [memberAllianceId, setMemberAllianceId] = useState<string | null>(null);
  const [memberAccountId, setMemberAccountId] = useState('');

  // Exclude confirmation with text input
  const [excludeTarget, setExcludeTarget] = useState<{ allianceId: string; gameAccountId: string; pseudo: string } | null>(null);
  const [excludeConfirmText, setExcludeConfirmText] = useState('');

  // Leave alliance confirmation
  const [leaveTarget, setLeaveTarget] = useState<{ allianceId: string; gameAccountId: string } | null>(null);

  const myAccountIds = new Set(myAccounts.map((a) => a.id));

  const fetchAlliances = async () => {
    try {
      const data = await getMyAlliances();
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

  const fetchMyAccounts = async () => {
    try {
      const data = await getMyGameAccounts();
      setMyAccounts(data);
      setHasAnyAccounts(data.length > 0);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (status === 'authenticated') {
      Promise.all([fetchAlliances(), fetchEligibleOwners(), fetchEligibleMembers(), fetchMyAccounts()]).then(() => {
        // createOpen stays false — will be overridden below after alliances load
      });
    }
  }, [status]);

  // Auto-open create form only if user has NO alliances yet
  useEffect(() => {
    if (!loading && alliances.length === 0) {
      setCreateOpen(true);
    }
  }, [loading, alliances.length]);

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
      setCreateOpen(false);
      await Promise.all([fetchAlliances(), fetchEligibleOwners(), fetchEligibleMembers(), fetchMyAccounts()]);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || t.game.alliances.createError);
    } finally {
      setCreating(false);
    }
  };

  // ---- Officers (promote / demote) ----
  const handlePromoteOfficer = async (allianceId: string, gameAccountId: string) => {
    try {
      await addOfficer(allianceId, gameAccountId);
      toast.success(t.game.alliances.adjointAddSuccess);
      await fetchAlliances();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || t.game.alliances.adjointAddError);
    }
  };

  const handleDemoteOfficer = async (allianceId: string, gameAccountId: string) => {
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
      setExcludeTarget(null);
      setExcludeConfirmText('');
      setLeaveTarget(null);
      await Promise.all([fetchAlliances(), fetchEligibleMembers(), fetchMyAccounts()]);
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

  /** Check if the current user is the owner of an alliance */
  const isOwner = (alliance: Alliance) => myAccountIds.has(alliance.owner_id);

  /** Check if the current user is an officer or owner in an alliance */
  const canManage = (alliance: Alliance) =>
    isOwner(alliance) || alliance.officers.some((o) => myAccountIds.has(o.game_account_id));

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

      {/* Create form — foldable */}
      <Card>
        <CardHeader
          className="cursor-pointer select-none"
          onClick={() => setCreateOpen((v) => !v)}
        >
          <CardTitle className="text-lg flex items-center gap-2">
            <Plus className="h-5 w-5" />
            {t.game.alliances.createTitle}
            {createOpen ? <ChevronUp className="h-4 w-4 ml-auto" /> : <ChevronDown className="h-4 w-4 ml-auto" />}
          </CardTitle>
        </CardHeader>
        {createOpen && (
          <CardContent>
            {!hasAnyAccounts ? (
              <p className="text-sm text-gray-500">{t.game.alliances.noGameAccount}</p>
            ) : eligibleOwners.length === 0 ? (
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
        )}
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
          {alliances.map((alliance) => {
            const userIsOwner = isOwner(alliance);
            const userCanManage = canManage(alliance);
            const officerCount = alliance.officers.length;

            return (
              <Card key={alliance.id}>
                <CardContent className="py-4 space-y-4">
                  {/* Alliance header */}
                  <div className="flex items-center gap-3">
                    <Shield className="h-5 w-5 text-purple-500" />
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-gray-900">{alliance.name}</p>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800">[{alliance.tag}]</span>
                        <span className="text-xs text-gray-400">
                          {alliance.member_count} {t.game.alliances.members} · {officerCount} {t.game.alliances.officersCount}
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

                  {/* Members section */}
                  <div className="border-t pt-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-green-500" />
                        <span className="text-sm font-medium text-gray-700">
                          {t.game.alliances.membersTitle} ({alliance.member_count})
                        </span>
                      </div>

                      {/* Add member button — at the top right */}
                      {userCanManage && (
                        memberAllianceId === alliance.id ? (
                          <div className="flex items-center gap-2">
                            <Select value={memberAccountId} onValueChange={setMemberAccountId}>
                              <SelectTrigger className="w-48 h-8 text-xs"><SelectValue placeholder={t.game.alliances.selectMember} /></SelectTrigger>
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
                        )
                      )}
                    </div>

                    {alliance.members.length > 0 && (
                      <div className="space-y-1">
                        {[...alliance.members]
                          .sort((a, b) => {
                            const rank = (m: typeof a) => m.is_owner ? 0 : m.is_officer ? 1 : 2;
                            return rank(a) - rank(b);
                          })
                          .map((member) => {
                            const isMine = myAccountIds.has(member.id);

                            return (
                              <div key={member.id} className="flex items-center justify-between py-1 px-2 rounded hover:bg-gray-50">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-gray-800">{member.game_pseudo}</span>
                                  {member.is_owner && (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-800">
                                      <Crown className="h-2.5 w-2.5" /> {t.game.alliances.owner}
                                    </span>
                                  )}
                                  {member.is_officer && !member.is_owner && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700">
                                      Officer
                                    </span>
                                  )}
                                  {member.alliance_group ? (
                                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs ${GROUP_COLORS[member.alliance_group]}`}>
                                      {t.game.alliances.group} {member.alliance_group}
                                    </span>
                                  ) : null}
                                  {isMine && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs bg-gray-100 text-gray-500">
                                      {t.game.alliances.you}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1">
                                  {/* Promote / Demote — owner only, not on self/owner */}
                                  {userIsOwner && !member.is_owner && (
                                    member.is_officer ? (
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="h-7 w-7 text-orange-400 hover:text-orange-600 hover:bg-orange-50"
                                              onClick={() => handleDemoteOfficer(alliance.id, member.id)}
                                            >
                                              <ShieldMinus className="h-3.5 w-3.5" />
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent>{t.game.alliances.demoteOfficer}</TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    ) : (
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="h-7 w-7 text-blue-400 hover:text-blue-600 hover:bg-blue-50"
                                              onClick={() => handlePromoteOfficer(alliance.id, member.id)}
                                            >
                                              <ShieldCheck className="h-3.5 w-3.5" />
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent>{t.game.alliances.promoteOfficer}</TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    )
                                  )}

                                  {/* Leave (own account) or Exclude (officer/owner action on others) */}
                                  {!member.is_owner && (
                                    isMine ? (
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="h-7 w-7 text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                                              onClick={() => setLeaveTarget({ allianceId: alliance.id, gameAccountId: member.id })}
                                            >
                                              <UserMinus className="h-3.5 w-3.5" />
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent>{t.game.alliances.leaveAlliance}</TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    ) : userCanManage ? (
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50"
                                              onClick={() => setExcludeTarget({ allianceId: alliance.id, gameAccountId: member.id, pseudo: member.game_pseudo })}
                                            >
                                              <UserMinus className="h-3.5 w-3.5" />
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent>{t.game.alliances.excludeMember}</TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    ) : null
                                  )}

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
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Leave alliance confirmation */}
      <ConfirmationDialog
        open={!!leaveTarget}
        onOpenChange={(open) => { if (!open) setLeaveTarget(null); }}
        title={t.common.confirm}
        description={t.game.alliances.leaveConfirm}
        onConfirm={() => {
          if (leaveTarget) {
            handleRemoveMember(leaveTarget.allianceId, leaveTarget.gameAccountId);
          }
        }}
        variant="destructive"
        confirmText={t.game.alliances.leaveAlliance}
      />

      {/* Exclude member confirmation — requires typing "confirmer" */}
      <AlertDialog
        open={!!excludeTarget}
        onOpenChange={(open) => { if (!open) { setExcludeTarget(null); setExcludeConfirmText(''); } }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.common.confirm}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.game.alliances.excludeConfirm.replace('{pseudo}', excludeTarget?.pseudo ?? '')}
            </AlertDialogDescription>
            <div className="mt-3 space-y-2">
              <Label className="text-sm text-gray-600">{t.game.alliances.excludeTypeConfirm}</Label>
              <Input
                value={excludeConfirmText}
                onChange={(e) => setExcludeConfirmText(e.target.value)}
                placeholder={t.game.alliances.excludeTypeConfirmPlaceholder}
                autoFocus
              />
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setExcludeTarget(null); setExcludeConfirmText(''); }}>
              {t.common.cancel}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              disabled={excludeConfirmText.toLowerCase() !== t.game.alliances.excludeTypeConfirmPlaceholder.toLowerCase()}
              onClick={() => {
                if (excludeTarget) {
                  handleRemoveMember(excludeTarget.allianceId, excludeTarget.gameAccountId);
                }
              }}
            >
              {t.game.alliances.excludeMember}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
