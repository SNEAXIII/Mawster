# TODO — war boost icons

The 2×2 boost mosaic on a war defense node renders `lucide-react` placeholders until the
real assets land here. Drop the PNGs below in this directory, then swap the placeholders in
`front/app/game/defense/_components/` (search for `BOOST_ICONS`).

| File | Boost | Placeholder |
| --- | --- | --- |
| `boost-power-start.png` | Advanced Power Start — 1 bar of power | `Zap` |
| `boost-invulnerability.png` | Invulnerability — first 3 hits | `ShieldCheck` |
| `boost-regeneration.png` | Combat Regeneration — 15% max health | `HeartPulse` |
| `boost-defense.png` | Defense Booster — 33% | `ShieldHalf` |
| `boost-power.png` | Power Booster — 200% | `BatteryCharging` |
| `boost-specials.png` | Specials Booster — 12% | `Swords` |

The first three share one mosaic cell — they are mutually exclusive in-game.
