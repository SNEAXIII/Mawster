# Mawster

Alliance management tool for Marvel Contest of Champions (MCOC): rosters, alliance
war planning, and the vision pipeline that reads a player's roster from screenshots.

## Language

### Identity

**Account**:
A person's login on Mawster, held via Discord or Google OAuth. Carries the platform
role and is the subject of moderation (mute, warn). Has no in-game meaning.
_Table_: `user`.
_Avoid_: user (in game-domain prose), profile.

**Player**:
One in-game MCOC identity bound to an Account. Everything in the game domain —
alliance membership, roster, war actions, authorship — refers to a Player, never to
an Account. An Account may bind up to 10 Players (an arbitrary anti-abuse cap).
_Table_: `game_account`.
_Avoid_: user, member, account.

Moderation is deliberately coarser than the game domain: muting an Account silences
every Player bound to it, while an officer demotion affects a single Player.

**Alliance**:
A group of up to 30 Players — three Battlegroups of ten — owned by one Player and
administered by Officers.

**Owner**:
The single Player an Alliance belongs to.

**Officer**:
A Player granted administration rights over an Alliance — placing defense, running
wars, inviting.

**Strategist**:
A Player granted placement rights over an Alliance, and no authority over its people:
they lay out the Defense Assignment for anyone and record the enemy defenders on the
War map, across all three Battlegroups. They invite nobody, remove nobody, promote
nobody. Ranks between a plain member and an Officer — the two are exclusive, and an
Officer demoted falls back to plain member, never to Strategist.
_Table_: `alliance_strategist`.
_Avoid_: planner, planneur, deputy.
_Debt_: the rule granting the placement right is spelled three times —
`AllianceService.can_place`, and again inline in each of the two maps
`get_my_roles` returns. Changing who may place means changing all three, and
only the first is covered by a guard test. They cannot simply call each other:
`can_place` queries, while `get_my_roles` reads relationships already loaded in
a loop. A pure predicate over the four id sets, called by all three, is the fix.

**Visitor**:
A Player attached to an Alliance in read-only: sees everything a plain member sees,
changes nothing. Permanent, with no expiry — a read-only member, not a guest pass.

The rank only means something because an Alliance's interior — its Players, its
Officers, its Defense Assignment — is closed to whoever holds no rank in it. Being
outside is the default; a Visitor is how you let someone in without letting them act.
_Debt_: `GET /alliances` and `GET /alliances/{id}` still hand the roster to any
authenticated Account, so today a Visitor grant adds nothing on that front.

**Admin**:
An Account with a platform-wide role (admin, super admin). Moderates Accounts and
handles reported Fight Notes. Unrelated to any Alliance rank — and with no way into an
Alliance's interior at all: a reported Fight Note is the only bridge, and a Player opens
it (see `docs/adr/0006-admins-cannot-read-alliance-interiors.md`).

**Battlegroup**:
One of the three squads of ten Players an Alliance splits into for war. Names both a
Player's squad membership and a coordinate on the war map. Membership is strict: a
Player acts only within their own Battlegroup and is never assigned to a node of
another.
_Avoid_: alliance group, BG (in prose), group.
_Debt_: `GameAccount.alliance_group` spells this concept a second time, untyped and
unbounded — should be renamed to `battlegroup` and given the `Battlegroup` type.

### Champions

**Champion**:
A catalog entry: one of the game's characters, identical for every Player.

**Roster Entry**:
One Player's copy of a Champion, with its stars, rank, signature and ascension. Two
Players owning the same Champion have two distinct Roster Entries.
_Table_: `champion_user`.
_Avoid_: champion user, instance, owned champion.
_Debt_: the table is named `champion_user` and keyed by `game_account_id` — a
historical misnomer. Should become `roster_entry`; the rename is a real migration
across API, front and E2E, so it is deferred, not accepted.

### War

**War**:
One battle between an Alliance and an Opponent, fought across the three Battlegroups.
May belong to a Season.

**Season**:
A numbered competitive period of 12 Wars. Sagas are scoped to a Season.

**Big Thing**:
A Season format that shrinks the War: every Player brings at most two attackers and
fights a single node, instead of the regular 50-node map. Rare — Seasons are normally
regular.

**Saga**:
A Season-scoped bonus attached to specific Champions. A Champion may carry an attack
saga, a defense saga, or both — the two are tracked apart so each side can be filtered
on its own.

**Opponent**:
The enemy alliance in one War, identified only by a name a Player typed. Opponents
are not Mawster users and have no Alliance row: two Wars against the same enemy are
deliberately unlinked.
_Avoid_: enemy alliance (as if it were an Alliance).

**War Ban**:
A Champion nobody may send as an Attacker in one War. Bans are offensive only — any
Champion may still be placed in defense. Two sources meet in the same list: the bans
the game imposes, which hold for a whole Season and vary by Tier, and the bans the two
alliances agreed on for that one War.
_Table_: `war_ban`.

**Elo**:
An Alliance's war rating. It moves only on Wars fought inside a Season
(`elo_change`) — off-season Wars leave it untouched.

**Tier**:
The difficulty bracket an Alliance wars in, derived from its Elo — 1 is the top, 20
the bottom and the starting point. It sets how hard the nodes hit, so two fights are
only comparable at equal Tier; that is why every War and every Fight Record carries
the Tier it was fought at.

A running War carries no Tier yet: it is stamped when the War is closed, on purpose,
so an Alliance Tier corrected late — after someone noticed it was stale mid-war — still
lands on the War and on the Elo it moves.

**Fight Record**:
A frozen record of one fight that actually happened: attacker and defender with the
stars, rank and ascension they had at the time. Stats are copied, never joined, so a
later rank-up cannot rewrite history.
_Table_: `war_fight_record`.
_Avoid_: fight, combat log.

**Matchup Builder** (experimental):
The feature rating attackers against targets to suggest who to send. Everything under
it is experimental — nothing here is settled domain yet.

**Matchup Rating** (experimental):
An Alliance's verdict (discouraged, ok, good) on one attacker against one target: an
enemy defender, a node, or both. Decoupled from Fight Records — it is not derived from
what actually happened.
_Avoid_: treating matchups as war history.

### War assignments

Three distinct roles, each bringing one Roster Entry into a War:

**Attacker**:
The Roster Entry that fights an enemy defender on a node.

**Prefight**:
A Roster Entry brought only for the buff it applies before a fight. Targets a node.
_Avoid_: attacker, support.

**Synergy Carrier**:
A Roster Entry brought only to buff another of your own Roster Entries. Targets a
champion, never a node — that is what separates it from a Prefight.
_Avoid_: synergy, support.

### War map

**War Node**:
One node of one War: the enemy defender an Officer recorded there, the Attacker
assigned to it, and what happened (KO count, completion).
_Table_: `war_defense_placement`.
_Avoid_: placement, war defense placement.

The enemy defender on a War Node is entered by an Officer to mirror what the game
shows. Nobody on your side placed it — `placed_by` reads "recorded by".

**Defense Assignment**:
Your own Alliance's defensive layout: which Roster Entry sits on which node of which
Battlegroup. One living layout, not a per-War snapshot — it evolves across a Season
and persists between Wars.
_Table_: `defense_placement`.
_Avoid_: defense placement (ambiguous with War Node), defense map.

The asymmetry is deliberate: your layout is a plan you reuse and refine, while an
enemy layout is throwaway scouting of a different Opponent every War.

### Vision

The pipeline that reads a Player's roster from game screenshots.

**Import**:
One session: the screenshots a Player sent together, read as a batch and reviewed as
a batch. A Player may have only one Import awaiting review at a time.

**Reading**:
What the AI understood of one champion on one screenshot: a name, class, stars, rank,
signature. A Reading is a guess, never a fact — its champion name is free text and
may match no Champion in the catalog. It becomes domain data only when the Player
accepts it and it turns into a Roster Entry.
_Table_: `vision_prediction`.
_Avoid_: prediction (internal), detection.

**Candidate**:
One of the other champions the AI considered for a Reading, with its score. Shown to
the Player so a wrong Reading can be corrected by hand.

**Margin**:
The gap between the best Candidate and the runner-up, surfaced to the Player as
Clear / Uncertain / Ambiguous. Low margin means the AI hesitated, not that it erred.

**Dataset Sample**:
A screenshot kept for training after the Player opted in. Stored apart from the rest
of the domain (its own object store, no foreign keys) so it outlives the Import. It
still records which Player sent it — not to exploit the identity, but so consent can
be withdrawn and their samples removed.
_Table_: `vision_sample`.

`vision_job` is queue plumbing, one screenshot in flight. It is not a domain term and
never appears in player-facing wording.

### Notes

**Fight Note**:
What a Player wrote about one node in one War. Private to their Alliance.
_Table_: `war_fight_note`.

A reported Fight Note leaves that privacy: its history becomes readable by Admins, who
may sanction the Account behind the author (see Account, Player).

**Cleared Note**:
A reported Fight Note an Admin judged fine: the report was unjustified and the note
stands. Clearing approves the note, it never publishes it — a Fight Note stays private
to its Alliance.
_Avoid_: whitelisted (the column name), approved note.

### Roster upkeep

**Upgrade Request**:
An Officer asking a Player — another Officer included — to take one of their Roster
Entries up to a given rank, so it can be used in war. Marked done when the Player has
ranked it.
_Table_: `requested_upgrade`.

**Rarity**:
A Roster Entry's stars and rank taken together, written the way the game does: "7r3".
A wire and display format only — stored as the typed `stars`/`rank` pair on both sides
(`ChampionUser`, `RequestedUpgrade`), parsed and compared through `ChampionRarity`.
Ordered on the (stars, rank) pair, never on the code — a star level outranks a rank.
_Avoid_: rarity string, rank code.

### Masteries

**Mastery**:
A game-side perk a Player unlocks and spends points in. Catalog entry, identical for
every Player.

**Mastery Loadout**:
One saved allocation of a Player's mastery points. A Player keeps two in Mawster — the
one they play on attack and the one they leave up on defense — because masteries get
re-swapped between the two roles.

For each Mastery a Player records what they have **unlocked** (the ceiling they can
reach without spending resources) plus their attack and defense allocations.

### Imported history

**Imported Fight Record**:
A Fight Record that belongs to no War in Mawster, loaded from a CSV: fights from before
the app existed, or from an outside source, brought in to enrich the history.
_Table_: `war_fight_record_import`.
