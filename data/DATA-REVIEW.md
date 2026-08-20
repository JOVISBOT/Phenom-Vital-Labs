# Peptide data - review log

Companion to `tools/migrate-units.js` (schema v2, unit fixes) and
`tools/apply-data-review.js` (schema v3, dose fixes).

The v2 pass fixed everything that was a *unit* error and deliberately stopped at
anything that meant picking a dose. This file recorded those deferrals. **They
were signed off and applied on 2026-08-20**; what follows is the record of what
changed and, at the bottom, what is genuinely still open.

Supersedes `ENHANCEMENT_PLAN.md` and `PEPTIDE_VERIFICATION_NEEDED.md`.

---

## RESOLVED 2026-08-20

### 1. Doses that did not match published protocols

| Peptide | Was | Now | Anchor |
|---|---|---|---|
| `cagrilintide` | 100/200/400 **mcg** | 1.2/2.4/4.5 **mg** | Phase 2 (n=706, 26wk) arms: 0.3, 0.6, 1.2, 2.4, 4.5 mg weekly |
| `retatrutide` | 1/2/4 mg | 4/8/12 mg | Phase 2 (n=338, 48wk, NEJM 2023) arms: 1, 4, 8, 12 mg weekly |
| `bpc157` **(NEW)** | 500/1000/2000 mcg | 250/500/1000 mcg | cited range is 250-500 mcg/day; med was 2x and high 4x that |
| `tb500` | 750/1500/3000 mcg | 1000/2000/2500 mcg | loading 2-2.5mg 2x/wk, maintenance 2-2.5mg/wk |

Cagrilintide was wrong in unit *and* magnitude - a 12x under-report that the v2
unit sweep missed because 100 mcg is a plausible number in isolation.

Vial and water defaults moved with the doses where the old default could no
longer be drawn: cagrilintide 5mg/3ml -> 10mg/2ml (the 2.4mg dose was 144u, past
a 100u barrel), retatrutide 10mg -> 30mg (12mg exceeded the vial outright).

### 2. Instruction text that contradicted the dose fields

| Peptide | Contradiction | Resolution |
|---|---|---|
| `blend_gh1` | high = 400mcg each; inst quoted 300mcg as "typical" | high -> 0.6mg (300 each). Convention is 100-300 mcg of each; 300 is the ceiling, not the norm. Saturation note added. |
| `blend_heal` | med = 750mcg each = 3.75mg/wk TB-500 | tiers -> 0.5/1.0/1.5. The inst text (500mcg each = 2.5mg/wk, TB-500's maintenance dose) was right; the dose fields moved to it. |
| `blend_heal_20` | tiers were double `blend_heal` for the same two peptides | tiers -> 0.5/1.0/1.5, identical to `blend_heal`. The 20mg vial is twice as concentrated - same dose, half the volume. Renamed from "(High Dose)" to "(20mg vial)", which is what it actually is. |
| `tb500` | inst said 5mg twice weekly = 10mg/wk | inst rewritten to the loading/maintenance split. 10mg/wk was ~4x maintenance and 2x loading. |
| `cagrisema` **(NEW)** | inst said "0.25mg total" | the real start is 0.25mg of *each* = 0.5mg total; low tier 1 -> 0.5 |
| `glutathione` **(NEW)** | inst named 1500-2000mg against a 500mg high tier | qualified as IV infusion, out of scope for a subq/IM draw - and more than three of its own vials |
| `tirzepatide` **(NEW)** | inst named 15mg as max, high was 10mg | high -> 15mg, vial 10 -> 20mg so it can be drawn |

### 3. Cycles stated in days

`f` x `wks` cannot express a course that is not a whole number of weeks. Added an
explicit `dosesPerCycle` that wins when present:

| Peptide | Protocol | `f` x `wks` said | Now |
|---|---|---|---|
| `thymalin` | "10mg daily for 10 days" | 14 doses / 7 vials | **10 doses / 5 vials** |
| `cortagen` | "20-day course" | 21 doses / 11 vials | **20 doses / 10 vials** |
| `crystagen` | "20-day course" | 21 doses / 11 vials | **20 doses / 10 vials** |

### 4. NEW bug class: a dose larger than the vial

The old `PLAUSIBLE_UNITS` test only checked the **recommended** tier, so four
records shipped a `high` tier needing more peptide than one reconstituted vial
holds. This is not the same as syringe overflow: overflow is fixable by picking a
bigger barrel or less water, but no water volume fixes this - **water dilutes, it
does not add peptide.**

`dulaglutide` was a plain defect and is fixed: its 4.5mg high tier is a real
Trulicity strength and 4.5mg was already in `vialSizes`, it just was not the
default. Fixed by making it the default.

The other three are now **surfaced rather than silently wrong** - the card reads
"More than one 100mg vial holds / 2 vials" and says why. See OPEN below.

### 5. Marketing copy

Header now reads "Research use only". Any purity claim that goes back must point
at actual certificates of analysis.

---

## STILL OPEN

**1. Three `high` tiers exceed the largest vial the record offers.**

| Peptide | high | largest `vialSizes` entry | vials per dose |
|---|---|---|---|
| `aicar` | 200 mg | 100 mg | 2.0 |
| `dihexa` | 32 mg | 30 mg | 1.6 |
| `hmg` | 300 IU | 150 IU | 2.0 |

Flagged in the UI and pinned by `EXCEEDS_VIAL_AT_HIGH` in the test suite, so a
fourth cannot appear unnoticed. Not silently corrected, because both readings are
plausible and neither is sourced: either the tier is too high, or the record is
missing a larger vial that really is sold. **Needs a real supplier catalogue to
settle** - the same evidence gap as item 2.

**2. Fourteen vial sizes are convention, not evidence.**

`gonadorelin` 2mg, `hexarelin` 5mg, `hgh` 10 IU, `hmg` 150 IU, `melanotan2` 10mg,
`motsc` 10mg, `pegmgf` 2mg, `pt141` 10mg, `retatrutide` 10mg (now 30mg),
`sermorelin` 5mg, `tb500` 5mg, `tesamorelin` 5mg, `thymalin` 20mg,
`tirzepatide` 10mg (now 20mg).

Vial size changes how far up the barrel you draw, not how much peptide you get -
a legibility problem, not a dosing one, as long as the user picks the size printed
on their own vial from the dropdown. Worth checking against a real price list.

**3. `dulaglutide` does not reconstitute at all.** Its own instructions say
"pre-filled pen device". The calculator computes a reconstitution draw for it
anyway. Harmless but meaningless; the record arguably does not belong in a
reconstitution calculator.

**4. No dose here is validated for human use.** BPC-157 and TB-500 have no human
dosing study at all - every figure is community convention extrapolated from
animal work, and the FDA compounding advisory committee voted 11-3 against adding
either to the 503A bulks list in July 2026. The published anchors used above
(cagrilintide, retatrutide, tirzepatide, dulaglutide) are trial arms in
supervised settings, not self-administration guidance.
